import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../hooks/useAuth";
import { listModels } from "../services/modelService";

export function DashboardPage() {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listModels()
      .then((data) => {
        if (active) setModels(data.models);
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
  }, []);

  if (isLoading) {
    return <LoadingState label="Loading workspace..." />;
  }

  const trainedCount = models.filter((model) => model.status === "TRAINED").length;
  const draftCount = models.filter((model) => model.status === "DRAFT").length;
  const isAdmin = user?.role === "SUPER_ADMIN";
  const modelPath = isAdmin ? "/admin/models" : "/models";

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-300">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Classification dashboard</h1>
          <p className="mt-3 text-sm text-slate-400">
            {isAdmin
              ? "Create, train, and manage CSV and image classification models."
              : "Browse trained CSV and image classification models and run tests."}
          </p>
        </div>
        <Link className="rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300" to={modelPath}>
          {isAdmin ? "Manage models" : "Browse trained models"}
        </Link>
      </div>

      {error ? <div className="mt-6"><ErrorState message={error} /></div> : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Models</p>
          <p className="mt-2 text-3xl font-semibold text-slate-100">{models.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Trained</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{trainedCount}</p>
        </div>
        {isAdmin ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Drafts</p>
            <p className="mt-2 text-3xl font-semibold text-amber-300">{draftCount}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Available to test</p>
            <p className="mt-2 text-3xl font-semibold text-cyan-300">{trainedCount}</p>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Signed in as</p>
          <p className="mt-2 font-medium text-slate-100">{user?.name}</p>
          <p className="mt-1 text-sm text-slate-400">{user?.email}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Account status</p>
          <p className="mt-2 font-medium capitalize text-cyan-300">{user?.role?.toLowerCase()}</p>
          <p className="mt-1 text-sm text-slate-400">{user?.approval_status?.toLowerCase()}</p>
        </div>
      </div>

      {!isAdmin ? (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-100">Available models</h2>
            <Link className="text-sm text-cyan-300 hover:text-cyan-200" to="/models">Browse all</Link>
          </div>
          {models.length ? (
            <div className="mt-4 divide-y divide-slate-800">
              {models.slice(0, 5).map((model) => (
                <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={model.id}>
                  <div>
                    <p className="font-medium text-slate-100">{model.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{model.model_type === "IMAGE" ? "Image classification" : "CSV classification"}</p>
                  </div>
                  <Link
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-cyan-600"
                    to={model.model_type === "IMAGE" ? `/models/${model.id}/image-prediction` : `/models/${model.id}/prediction`}
                  >
                    Test model
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No trained models are available to test yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
