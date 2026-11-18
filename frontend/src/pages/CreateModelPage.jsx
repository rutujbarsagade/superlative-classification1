import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { createModel } from "../services/modelService";

export function CreateModelPage({ admin = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    description: "",
    algorithm: "AUTO",
    model_type: searchParams.get("type") === "IMAGE" ? "IMAGE" : "CSV",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = await createModel(form);
      navigate(form.model_type === "IMAGE" ? `/models/${data.model.id}/images` : `/models/${data.model.id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Link className="text-sm text-slate-400 hover:text-slate-200" to={admin ? "/admin/models" : "/models"}>
        ← Back to models
      </Link>
      <div className="mt-6">
        <p className="text-sm font-medium text-cyan-300">Model registry</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create a model</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Create a tabular model from a CSV or train an image classifier from labeled camera captures.
        </p>
      </div>

      <form className="mt-8 space-y-5 rounded-xl border border-slate-800 bg-slate-900/60 p-6" onSubmit={handleSubmit}>
        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-300">Model type</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Model type">
            {[["CSV", "Tabular"], ["IMAGE", "Image classification"]].map(([value, label]) => (
              <button
                aria-checked={form.model_type === value}
                className={`rounded-md border px-3 py-2.5 text-sm font-medium transition ${form.model_type === value ? "border-cyan-400 bg-cyan-950/40 text-cyan-200" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}
                key={value}
                onClick={() => setForm((current) => ({ ...current, model_type: value }))}
                role="radio"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="model-name">Model name</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
            id="model-name"
            name="name"
            onChange={updateField}
            required
            value={form.name}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="model-description">Description</label>
          <textarea
            className="min-h-28 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
            id="model-description"
            name="description"
            onChange={updateField}
            value={form.description}
          />
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-sm font-medium text-slate-200">
            {form.model_type === "IMAGE" ? "Camera-based image training" : "Automatic model selection"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {form.model_type === "IMAGE"
              ? "Capture or upload labeled examples. Training and evaluation run when you start training."
              : "The task type and best-performing algorithm will be selected from the dataset."}
          </p>
        </div>
        {error ? <ErrorState message={error} /> : null}
        <button
          className="rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating..." : "Create model"}
        </button>
      </form>
    </section>
  );
}