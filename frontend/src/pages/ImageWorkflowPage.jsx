import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { deleteImageSample, getImageSamples, predictImage, uploadImageSample } from "../services/imageService";
import { getModel } from "../services/modelService";
import { startTraining } from "../services/trainingService";

export function ImageWorkflowPage() {
  const { modelId } = useParams();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [model, setModel] = useState(null);
  const [samples, setSamples] = useState([]);
  const [classCounts, setClassCounts] = useState({});
  const [sampleCount, setSampleCount] = useState(0);
  const [className, setClassName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [job, setJob] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function applySummary(data) {
    setSamples(data.samples || []);
    setClassCounts(data.class_counts || {});
    setSampleCount(data.sample_count || 0);
    setModel((current) => current ? { ...current, status: data.model_status } : current);
  }

  async function loadWorkflow() {
    setError("");
    try {
      const [modelData, sampleData] = await Promise.all([getModel(modelId), getImageSamples(modelId)]);
      setModel(modelData.model);
      applySummary(sampleData);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWorkflow();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [modelId]);

  async function startCamera() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable. Use a secure browser connection or upload an image.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (requestError) {
      setError(requestError.message || "Camera permission was denied.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function addSample(file) {
    if (!file) return;
    if (!className.trim()) {
      setError("Enter a class name before adding an image.");
      return;
    }
    setError("");
    setNotice("");
    setIsUploading(true);
    try {
      const data = await uploadImageSample(modelId, file, className.trim());
      applySummary(data);
      setSelectedFile(null);
      setNotice(`Image added to ${className.trim()}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function captureImage() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video?.videoWidth || !canvas) {
      setError("Wait for the camera preview before capturing an image.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) addSample(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
      else setError("The camera image could not be captured.");
    }, "image/jpeg", 0.9);
  }

  async function handleTrain() {
    setError("");
    setNotice("");
    setIsTraining(true);
    try {
      const data = await startTraining(modelId);
      setJob(data.job);
      setModel((current) => ({ ...current, status: data.model_status }));
      setNotice("Image model training completed.");
    } catch (requestError) {
      await loadWorkflow();
      setError(requestError.message);
    } finally {
      setIsTraining(false);
    }
  }

  async function handleDelete(sampleId) {
    setDeletingId(sampleId);
    setError("");
    try {
      await deleteImageSample(modelId, sampleId);
      applySummary(await getImageSamples(modelId));
      setNotice("Image removed from the training set.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTest(event) {
    event.preventDefault();
    if (!testFile) return;
    setError("");
    setPrediction(null);
    setIsTesting(true);
    try {
      setPrediction(await predictImage(modelId, testFile));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) return <LoadingState label="Loading image model..." />;
  if (error && !model) return <ErrorState message={error} onRetry={loadWorkflow} />;
  if (model?.model_type !== "IMAGE") return <ErrorState message="This workflow is only available for image models." />;

  const classes = Object.entries(classCounts);
  const canTrain = classes.length >= 2 && classes.every(([, count]) => count >= 2);
  const isTrained = model.status === "TRAINED" || job?.status === "COMPLETED";

  return (
    <section className="mx-auto max-w-5xl">
      <Link className="text-sm text-slate-400 hover:text-slate-200" to={`/models/${modelId}`}>
        ← Back to model
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-300">Image classification · Model {modelId}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{model.name}</h1>
          <p className="mt-2 text-sm text-slate-400">{sampleCount} labeled images · {classes.length} classes</p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">{model.status}</span>
      </div>

      {error ? <div className="mt-6"><ErrorState message={error} /></div> : null}
      {notice ? <p className="mt-5 rounded-md border border-emerald-900/70 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200" role="status">{notice}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-52 flex-1 space-y-2">
                <label className="text-sm text-slate-300" htmlFor="image-class">Class name</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  id="image-class"
                  maxLength="80"
                  onChange={(event) => setClassName(event.target.value)}
                  placeholder="For example, mug"
                  value={className}
                />
              </div>
              {!cameraOn ? (
                <button className="rounded-md border border-cyan-700 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950/40" onClick={startCamera} type="button">
                  Open camera
                </button>
              ) : (
                <button className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800" onClick={stopCamera} type="button">
                  Close camera
                </button>
              )}
            </div>
            <div className="mt-5 overflow-hidden rounded-md bg-black">
              <video className={`aspect-video max-h-[440px] w-full object-contain ${cameraOn ? "block" : "hidden"}`} ref={videoRef} muted playsInline />
              {!cameraOn ? <div className="flex aspect-video items-center justify-center text-sm text-slate-500">Camera preview</div> : null}
            </div>
            <canvas className="hidden" ref={canvasRef} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!cameraOn || isUploading || !className.trim()}
                onClick={captureImage}
                type="button"
              >
                {isUploading ? "Saving image..." : "Capture image"}
              </button>
              <label className="cursor-pointer rounded-md border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500">
                Upload image
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setSelectedFile(file || null);
                    if (file) addSample(file);
                    event.target.value = "";
                  }}
                  type="file"
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-100">Training images</h2>
              <span className="text-xs text-slate-500">5 MB max per image</span>
            </div>
            {classes.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {classes.map(([label, count]) => (
                  <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2.5" key={label}>
                    <span className="truncate text-sm text-slate-200">{label}</span>
                    <span className={`ml-3 text-xs ${count >= 2 ? "text-emerald-300" : "text-amber-300"}`}>{count} images</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No labeled images have been added.</p>
            )}
            {samples.length ? (
              <ul className="mt-4 divide-y divide-slate-800 border-t border-slate-800">
                {samples.slice(-12).reverse().map((sample) => (
                  <li className="flex items-center justify-between gap-4 py-2.5" key={sample.id}>
                    <span className="truncate text-sm text-slate-300">{sample.class_name}</span>
                    <button
                      className="shrink-0 text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                      disabled={deletingId === sample.id}
                      onClick={() => handleDelete(sample.id)}
                      type="button"
                    >
                      {deletingId === sample.id ? "Removing..." : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="font-semibold text-slate-100">Train classifier</h2>
            <p className="mt-2 text-sm text-slate-400">{canTrain ? "Ready to train on labeled images." : "Add at least two images to each of two classes."}</p>
            <button
              className="mt-5 w-full rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canTrain || isTraining}
              onClick={handleTrain}
              type="button"
            >
              {isTraining ? "Training..." : model.status === "TRAINED" ? "Retrain model" : "Train model"}
            </button>
            {(job?.metrics?.accuracy ?? model.metadata?.holdout_accuracy) !== undefined ? (
              <p className="mt-4 text-sm text-emerald-300">Latest holdout accuracy: {((job?.metrics?.accuracy ?? model.metadata?.holdout_accuracy) * 100).toFixed(1)}%</p>
            ) : null}
            {job?.metrics?.confusion_matrix ? (
              <div className="mt-4 overflow-x-auto">
                <p className="mb-2 text-xs uppercase text-slate-500">Holdout confusion matrix</p>
                <table className="w-full text-center text-xs text-slate-300">
                  <tbody>
                    {job.metrics.confusion_matrix.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((value, columnIndex) => (
                          <td className="border border-slate-700 px-2 py-1.5" key={columnIndex}>{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-500">Class order: {job.metrics.class_labels?.join(", ")}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="font-semibold text-slate-100">Test model</h2>
            {!isTrained ? <p className="mt-2 text-sm text-slate-500">Train the classifier before testing an image.</p> : null}
            <form className="mt-4 space-y-4" onSubmit={handleTest}>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-sm text-slate-400 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:text-slate-100"
                disabled={!isTrained || isTesting}
                onChange={(event) => {
                  setTestFile(event.target.files?.[0] || null);
                  setPrediction(null);
                }}
                type="file"
              />
              <button
                className="w-full rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!isTrained || !testFile || isTesting}
                type="submit"
              >
                {isTesting ? "Classifying..." : "Classify image"}
              </button>
            </form>
            {prediction ? (
              <div className="mt-5 border-t border-slate-800 pt-4" role="status">
                <p className="text-xs uppercase text-emerald-300">Predicted class</p>
                <p className="mt-1 break-words text-2xl font-semibold text-slate-100">{prediction.predicted_class}</p>
                <p className="mt-1 text-sm text-slate-400">Confidence: {(prediction.probability * 100).toFixed(1)}%</p>
                <div className="mt-4 space-y-2">
                  {Object.entries(prediction.probabilities || {}).map(([label, probability]) => (
                    <div className="flex justify-between gap-3 text-xs" key={label}>
                      <span className="truncate text-slate-400">{label}</span>
                      <span className="text-slate-200">{(probability * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}