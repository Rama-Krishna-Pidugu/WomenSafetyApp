import { apiClient } from "../../api/apiClient";
import type {
  FaceListResponse,
  FaceRegistrationResponse,
  FaceVerificationResponse,
} from "./face.types";

class FaceRepository {
  async registerFace(
    imageUri: string,
    name: string,
    relationship: string,
  ): Promise<FaceRegistrationResponse> {
    const formData = new FormData();

    formData.append("name", name);
    formData.append("relationship", relationship);

    formData.append("image", {
      uri: imageUri,
      name: "trusted-face.jpg",
      type: "image/jpeg",
    } as any);

    const response = await apiClient.post<FaceRegistrationResponse>(
      "/api/v1/face/register",
      formData,
      {
        transformRequest: (data) => data,
      },
    );

    return response.data;
  }

  async getTrustedFaces(): Promise<FaceListResponse> {
    const response = await apiClient.get<FaceListResponse>(
      "/api/v1/face/trusted",
    );

    return response.data;
  }

  async verifyFace(
    imageUri: string,
  ): Promise<FaceVerificationResponse> {
    const formData = new FormData();

    formData.append("image", {
      uri: imageUri,
      name: "verification-face.jpg",
      type: "image/jpeg",
    } as any);

    const response = await apiClient.post<FaceVerificationResponse>(
      "/api/v1/face/verify",
      formData,
      {
        transformRequest: (data) => data,
      },
    );

    return response.data;
  }

  async deleteTrustedFace(faceId: string): Promise<void> {
    await apiClient.delete(`/api/v1/face/trusted/${faceId}`);
  }
}

export const faceRepository = new FaceRepository();