from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.security import get_current_firebase_uid
from app.db.database import get_supabase
from app.services.face.face_service import face_service


router = APIRouter(
    prefix="/face",
    tags=["Face Verification"],
)


@router.post("/register")
async def register_face(
    name: str = Form(...),
    relationship: str = Form(...),
    image: UploadFile = File(...),
    firebase_uid: str = Depends(get_current_firebase_uid),
):
    """Register a trusted person's face for the authenticated user."""

    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty. Please capture or select a valid photo.",
        )

    # Validate image format via content_type, magic bytes, or file extension
    is_valid_image = (
        (image.content_type and (image.content_type.startswith("image/") or image.content_type == "application/octet-stream"))
        or image_bytes.startswith((b"\xff\xd8\xff", b"\x89PNG", b"RIFF", b"BM", b"\x00\x00\x00\x18ftyp", b"\x00\x00\x00\x1cftyp", b"\x00\x00\x00\x20ftyp"))
        or (image.filename and image.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp")))
    )

    if not is_valid_image:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be a valid image (JPEG/PNG/WebP).",
        )

    try:
        embedding = face_service.get_embedding(image_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Face processing error: {exc}",
        ) from exc

    supabase = get_supabase()

    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured.",
        )

    try:
        result = (
            supabase
            .table("trusted_faces")
            .insert(
                {
                    "user_id": firebase_uid,
                    "name": name,
                    "relationship": relationship,
                    "embedding": embedding,
                }
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to store trusted face.",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=500,
            detail="Trusted face was not created.",
        )

    return {
        "success": True,
        "message": "Trusted face registered successfully.",
        "face": result.data[0],
    }


@router.get("/trusted")
async def get_trusted_faces(
    firebase_uid: str = Depends(get_current_firebase_uid),
):
    """Get trusted faces belonging to the authenticated user."""

    supabase = get_supabase()

    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured.",
        )

    try:
        result = (
            supabase
            .table("trusted_faces")
            .select("id,name,relationship,created_at")
            .eq("user_id", firebase_uid)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve trusted faces.",
        ) from exc

    return {
        "success": True,
        "faces": result.data or [],
    }


@router.delete("/trusted/{face_id}")
async def delete_trusted_face(
    face_id: str,
    firebase_uid: str = Depends(get_current_firebase_uid),
):
    """Delete a trusted face belonging to the authenticated user."""

    supabase = get_supabase()

    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured.",
        )

    try:
        result = (
            supabase
            .table("trusted_faces")
            .delete()
            .eq("id", face_id)
            .eq("user_id", firebase_uid)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete trusted face.",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="Trusted face not found.",
        )

    return {
        "success": True,
        "message": "Trusted face deleted successfully.",
    }


@router.post("/verify")
async def verify_face(
    image: UploadFile = File(...),
    firebase_uid: str = Depends(get_current_firebase_uid),
):
    """Verify a captured face against the user's trusted faces."""

    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty. Please capture or select a valid photo.",
        )

    # Validate image format via content_type, magic bytes, or file extension
    is_valid_image = (
        (image.content_type and (image.content_type.startswith("image/") or image.content_type == "application/octet-stream"))
        or image_bytes.startswith((b"\xff\xd8\xff", b"\x89PNG", b"RIFF", b"BM", b"\x00\x00\x00\x18ftyp", b"\x00\x00\x00\x1cftyp", b"\x00\x00\x00\x20ftyp"))
        or (image.filename and image.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp")))
    )

    if not is_valid_image:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be a valid image (JPEG/PNG/WebP).",
        )

    try:
        probe_embedding = face_service.get_embedding(image_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Face processing error: {exc}",
        ) from exc

    supabase = get_supabase()

    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured.",
        )

    try:
        result = (
            supabase
            .table("trusted_faces")
            .select("id,name,relationship,embedding")
            .eq("user_id", firebase_uid)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve trusted faces.",
        ) from exc

    trusted_faces = result.data or []

    if not trusted_faces:
        return {
            "success": True,
            "verified": False,
            "message": "No trusted faces registered.",
        }

    best_match = None
    best_similarity = -1.0

    for trusted_face in trusted_faces:
        registered_embedding = trusted_face.get("embedding")

        if not registered_embedding:
            continue

        try:
            comparison = face_service.verify(
                probe_embedding,
                registered_embedding,
            )
        except (TypeError, ValueError):
            continue

        if comparison["similarity"] > best_similarity:
            best_similarity = comparison["similarity"]
            best_match = trusted_face

    if best_match is None:
        return {
            "success": True,
            "verified": False,
            "message": "No valid trusted face embeddings found.",
        }

    threshold = 0.40
    verified = best_similarity >= threshold

    return {
        "success": True,
        "verified": verified,
        "similarity": best_similarity,
        "threshold": threshold,
        "match": (
            {
                "id": best_match["id"],
                "name": best_match["name"],
                "relationship": best_match["relationship"],
            }
            if verified
            else None
        ),
    }