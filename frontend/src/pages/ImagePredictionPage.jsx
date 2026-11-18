import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { predictImage } from "../services/imageService";
import { getModel } from "../services/modelService";

export function ImagePredictionPage() {
  const { modelId } = useParams();
  const [model, setModel] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);

  useEffect(() => {
    let active = true;
    getModel(modelId)
      .then(({ model: responseModel }) => {
        if (active) setModel(responseModel);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [modelId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setResult(null);
    setIsPredicting(true);
    try {
      setResult(await predictImage(modelId, file));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsPredicting(false);
    }
  }

  if (isLoading) return <LoadingState label="Loading image model..." />;
  if (error && !model) return <ErrorState message={error} />;
  if (model?.model_type !== "IMAGE") return <ErrorState message="This is not an image classification model." />;

  return (
    <section className="mx-auto max-w-3xl">
      <Link className="text-sm text-slate-400 hover:text-slate-200" to={`/models/${modelId}`}>
        ← Back to model
      </Link>
      <div className="mt-6">
        <p className="text-sm font-medium text-cyan-300">Image model test</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{model.name}</h1>
      </div>
      {error ? <div className="mt-6"><ErrorState message={error} /></div> : null}
      {model.status !== "TRAINED" ? (
        <p className="mt-6 rounded-md border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-200">This model has not been trained yet.</p>
      ) : (
        <form className="mt-8 max-w-xl space-y-5 rounded-lg border border-slate-800 bg-slate-900/60 p-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="test-image">Image</label>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-slate-400 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:text-slate-100"
              id="test-image"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setResult(null);
              }}
              required
              type="file"
            />
          </div>
          <button
            className="rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!file || isPredicting}
            type="submit"
          >
            {isPredicting ? "Classifying..." : "Classify image"}
          </button>
        </form>
      )}
      {result ? (
        <div className="mt-6 max-w-xl rounded-lg border border-emerald-900/70 bg-emerald-950/30 p-5" role="status">
          <p className="text-xs uppercase text-emerald-300">Predicted class</p>
          <p className="mt-2 break-words text-2xl font-semibold text-slate-100">{result.predicted_class}</p>
          <p className="mt-2 text-sm text-emerald-200">Confidence: {(result.probability * 100).toFixed(1)}%</p>
          <div className="mt-5 space-y-2">
            {Object.entries(result.probabilities || {}).map(([label, probability]) => (
              <div className="flex justify-between gap-3 text-sm" key={label}>
                <span className="truncate text-slate-300">{label}</span>
                <span className="text-slate-100">{(probability * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}