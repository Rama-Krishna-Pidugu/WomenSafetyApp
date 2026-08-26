from __future__ import annotations

import io
from pathlib import Path
from typing import Any

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[3]

FACE_MODEL_DIR = BASE_DIR / "models" / "face"

SFACE_MODEL_PATH = (
    FACE_MODEL_DIR / "face_recognition_sface_2021dec_int8.onnx"
)

YUNET_MODEL_PATH = (
    FACE_MODEL_DIR / "face_detection_yunet_2023mar.onnx"
)

FACE_MATCH_THRESHOLD = 0.40


class FaceService:
    """
    Face detection, SFace embedding generation and face verification.

    Pipeline:

        image
          ↓
        YuNet face detection
          ↓
        SFace alignCrop()
          ↓
        SFace feature()
          ↓
        L2-normalized embedding
          ↓
        cosine similarity
    """

    def __init__(self) -> None:
        self.detector = None
        self.recognizer = None

        if cv2 is None:
            print("[FaceService] OpenCV (cv2) not available - face recognition disabled in dev mode")
            return

        if not SFACE_MODEL_PATH.exists() or not YUNET_MODEL_PATH.exists():
            print("[FaceService] Model files not found - face recognition disabled in dev mode")
            return

        try:
            # YuNet face detector
            self.detector = cv2.FaceDetectorYN.create(
                str(YUNET_MODEL_PATH),
                "",
                (320, 320),
                0.5,
                0.3,
                5000,
            )

            # OpenCV's native SFace recognizer
            self.recognizer = cv2.FaceRecognizerSF.create(
                str(SFACE_MODEL_PATH),
                "",
            )

            print("[FaceService] YuNet loaded")
            print("[FaceService] SFace loaded")
        except Exception as e:
            print(f"[FaceService] Model init error: {e}")

    # -----------------------------------------------------------------------
    # Image decoding
    # -----------------------------------------------------------------------

    @staticmethod
    def _decode_image(image_bytes: bytes) -> np.ndarray:
        if not image_bytes:
            raise ValueError("Uploaded image is empty.")

        array = np.frombuffer(image_bytes, dtype=np.uint8)

        image = cv2.imdecode(array, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Unable to decode uploaded image.")

        return image

    # -----------------------------------------------------------------------
    # Face detection
    # -----------------------------------------------------------------------

    def _detect_face(
        self,
        image: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Detect the most prominent face in an image.
        Supports multi-orientation rotation fallback for mobile camera photos.
        Returns (aligned_image, best_face_data).
        """
        if self.detector is None or self.recognizer is None:
            raise ValueError("Face recognition engine is not initialized on the server.")

        # Scale down large mobile images to max 1024px for YuNet accuracy & performance
        h, w = image.shape[:2]
        max_dim = 1024
        if max(h, w) > max_dim:
            scale = max_dim / float(max(h, w))
            image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        # Try natural orientation first, then 90-degree rotations for mobile camera EXIF orientation differences
        orientations = [
            (image, 0),
            (cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE), 90),
            (cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE), 270),
            (cv2.rotate(image, cv2.ROTATE_180), 180),
        ]

        best_face = None
        best_image = image
        best_score = -1.0

        for current_img, _ in orientations:
            cur_h, cur_w = current_img.shape[:2]
            self.detector.setInputSize((cur_w, cur_h))
            _, faces = self.detector.detect(current_img)

            if faces is not None and len(faces) > 0:
                # Find face with largest area * confidence score
                candidate = max(
                    faces,
                    key=lambda f: float(f[2] * f[3]) * float(f[-1] if len(f) > 4 else 1.0),
                )
                score = float(candidate[2] * candidate[3])
                if score > best_score:
                    best_score = score
                    best_face = candidate
                    best_image = current_img
                # If high-confidence face found, break early
                break

        if best_face is None:
            raise ValueError(
                "No face detected in the photo. Please ensure your face is well-lit, centered, and facing the camera directly."
            )

        return best_image, best_face

    # -----------------------------------------------------------------------
    # Embedding generation
    # -----------------------------------------------------------------------

    def get_embedding(
        self,
        image_bytes: bytes,
    ) -> list[float]:
        """
        Generate an SFace embedding from an uploaded image.

        Uses OpenCV's official YuNet + SFace alignment pipeline.
        """

        image = self._decode_image(image_bytes)

        image, face = self._detect_face(image)

        # OpenCV performs the required face alignment internally.
        aligned_face = self.recognizer.alignCrop(
            image,
            face,
        )

        feature = self.recognizer.feature(
            aligned_face,
        )

        embedding = np.asarray(
            feature,
            dtype=np.float32,
        ).flatten()

        if embedding.size == 0:
            raise ValueError(
                "SFace returned an empty embedding."
            )

        # Normalize the embedding so cosine similarity is stable.
        norm = np.linalg.norm(embedding)

        if norm == 0:
            raise ValueError(
                "Invalid face embedding."
            )

        embedding = embedding / norm

        return embedding.astype(np.float32).tolist()

    # -----------------------------------------------------------------------
    # Similarity
    # -----------------------------------------------------------------------

    @staticmethod
    def cosine_similarity(
        embedding_a: list[float],
        embedding_b: list[float],
    ) -> float:
        a = np.asarray(
            embedding_a,
            dtype=np.float32,
        ).flatten()

        b = np.asarray(
            embedding_b,
            dtype=np.float32,
        ).flatten()

        if a.size == 0 or b.size == 0:
            raise ValueError(
                "Face embedding cannot be empty."
            )

        if a.size != b.size:
            raise ValueError(
                f"Embedding dimensions do not match: "
                f"{a.size} != {b.size}"
            )

        a_norm = np.linalg.norm(a)
        b_norm = np.linalg.norm(b)

        if a_norm == 0 or b_norm == 0:
            raise ValueError(
                "Cannot compare zero-length embeddings."
            )

        return float(
            np.dot(a, b) / (a_norm * b_norm)
        )

    # -----------------------------------------------------------------------
    # Verification
    # -----------------------------------------------------------------------

    def verify(
        self,
        probe_embedding: list[float],
        registered_embedding: list[float],
        threshold: float = FACE_MATCH_THRESHOLD,
    ) -> dict[str, Any]:
        """
        Compare a probe embedding against a registered embedding.
        """

        similarity = self.cosine_similarity(
            probe_embedding,
            registered_embedding,
        )

        verified = similarity >= threshold

        return {
            "verified": verified,
            "similarity": similarity,
            "threshold": threshold,
        }


face_service = FaceService()