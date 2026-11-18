import { apiRequest } from "./apiClient";

export function getImageSamples(modelId) {
  return apiRequest(`/models/${modelId}/images/`);
}

export function uploadImageSample(modelId, image, className) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("class_name", className);
  return apiRequest(`/models/${modelId}/images/`, {
    method: "POST",
    body: formData,
  });
}

export function deleteImageSample(modelId, sampleId) {
  return apiRequest(`/models/${modelId}/images/${sampleId}/`, { method: "DELETE" });
}

export function predictImage(modelId, image) {
  const formData = new FormData();
  formData.append("image", image);
  return apiRequest(`/models/${modelId}/prediction/image/`, {
    method: "POST",
    body: formData,
  });
}