import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { firebaseAuth } from "../context/firebase"; // keep same import pattern
import ProfileMenu from "./ProfileMenu";

// UploadCaseFile: uploads a PDF to the Flask backend /api/v1/upload-case-file
// Two-step workflow UI: Upload -> Search -> Analyze
export default function UploadCaseFile() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("upload"); // upload | search | analyze

  // SEARCH state
  const [daysBack, setDaysBack] = useState(7);
  const [maxResults, setMaxResults] = useState(20);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // ANALYZE state
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
        } catch (err) {
          console.error("Failed to get ID token:", err);
          setError("Failed to authenticate. Please sign in again.");
        }
      } else {
        setIdToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const onFileChange = (e) => {
    setError(null);
    const f = e.target.files?.[0] || null;
    if (f && f.name && f.name.toLowerCase().endsWith(".pdf")) {
      setSelectedFile(f);
    } else if (f) {
      setError("Only PDF files are supported.");
      setSelectedFile(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        setError("Only PDF files are supported.");
        return;
      }
      setSelectedFile(f);
      setError(null);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearAll = () => {
    setSelectedFile(null);
    setProgress(0);
    setUploadResult(null);
    setError(null);
    setSearchResults([]);
    setSelectedArticles([]);
    setAnalysisResult(null);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const uploadFile = async () => {
    setError(null);
    setUploadResult(null);

    if (!idToken) {
      setError("You must be signed in to upload a case file.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a PDF to upload.");
      return;
    }

    const form = new FormData();
    form.append("file", selectedFile);

    try {
      setUploading(true);
      setProgress(0);

      const resp = await axios.post(
        ( "https://64084ae02413.ngrok-free.app") + "/api/v1/upload-case-file",
        form,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${idToken}`,
          },
          onUploadProgress: (evt) => {
            if (evt.total) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              setProgress(pct);
            }
          },
          timeout: 180000, // 3 minutes
        }
      );

      setUploadResult(resp.data || null);
      // move to next step when upload succeeds
      setStep("search");
    } catch (err) {
      console.error("Upload error:", err);
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const searchArticles = async () => {
    setError(null);
    setSearchResults([]);

    if (!idToken) {
      setError("You must be signed in to search articles.");
      return;
    }

    try {
      setSearching(true);
      const resp = await axios.post(
        ( "https://64084ae02413.ngrok-free.app") + "/api/v1/search-articles",
        { days_back: Number(daysBack), max_results: Number(maxResults) },
        { headers: { Authorization: `Bearer ${idToken}` }, timeout: 120000 }
      );

      setSearchResults(resp.data.articles || []);
      // move to analyze stage automatically if we got articles
      setStep("analyze");
    } catch (err) {
      console.error("Search error:", err);
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const toggleArticleSelection = (idx) => {
    setSelectedArticles((prev) => {
      const exists = prev.includes(idx);
      if (exists) return prev.filter((i) => i !== idx);
      return [...prev, idx];
    });
  };

  const analyzeArticles = async () => {
    setError(null);
    setAnalysisResult(null);

    if (!idToken) {
      setError("You must be signed in to analyze articles.");
      return;
    }

    // build selected articles payload; if none selected, back-end will auto-load if supported
    const articlesPayload = selectedArticles.length
      ? selectedArticles.map((i) => searchResults[i])
      : searchResults.slice(0, 10); // default to first 10 if none selected

    if (articlesPayload.length === 0) {
      setError("No articles to analyze. Run a search first.");
      return;
    }

    try {
      setAnalyzing(true);
      const resp = await axios.post(
        ( "https://64084ae02413.ngrok-free.app") + "/api/v1/analyze-articles",
        { articles: articlesPayload },
        { headers: { Authorization: `Bearer ${idToken}` }, timeout: 300000 }
      );

      setAnalysisResult(resp.data || null);
    } catch (err) {
      console.error("Analyze error:", err);
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#343541] text-white">
      {/* Sidebar - minimal */}
      <aside className="w-64 bg-[#F0F8F8] border-r-3 border-teal-600 flex flex-col">
        <div className="p-4 border-b bg-teal-600 border-teal-600 text-center text-lg font-bold text-white">
          Case Monitor
        </div>

        <div className="p-6 border-b border-teal-600">
          <button
            onClick={clearAll}
            className="w-full flex items-center justify-center gap-2 p-3 bg-teal-600 hover:bg-teal-700 rounded-md text-white font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Reset
          </button>
        </div>

        <div className="flex-1" />
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 bg-[#F0F8F8]">
        <header className="relative p-4 bg-teal-600 text-white flex justify-center items-center shadow-md">
          <h1 className="text-lg font-semibold">Upload Case File</h1>
          <div className="absolute right-4">
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto flex items-start justify-center">
          <div className="w-full max-w-4xl mx-auto bg-white rounded-lg p-6 shadow-md text-gray-800">
            <p className="mb-6 text-center">
              Upload a PDF of the case documents. The backend will extract legal entities,
              index the document, and prepare monitoring terms.
            </p>

            {/* STEP: Upload (visible when step === 'upload') */}
            {step === "upload" && (
              <div className="flex flex-col items-center gap-6">
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  className="w-full border-2 border-dashed border-teal-200 rounded-md p-8 text-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={onFileChange}
                  />

                  {!selectedFile ? (
                    <div>
                      <div className="text-xl font-semibold">Drop PDF here, or click to select</div>
                      <div className="text-sm text-gray-500 mt-2">Only PDF files are supported</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="font-semibold">{selectedFile.name}</div>
                      <div className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  )}
                </div>

                <div className="w-full flex items-center gap-4 justify-center">
                  <button
                    onClick={uploadFile}
                    disabled={uploading}
                    className="px-6 py-3 bg-teal-600 hover:bg-teal-700 rounded-md text-white disabled:opacity-50 transition-shadow shadow-sm"
                  >
                    {uploading ? "Uploading..." : "Upload PDF"}
                  </button>

                  <div className="w-2/3">
                    <div className="text-sm text-gray-600 mb-1">Progress</div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div style={{ width: `${progress}%` }} className="h-full bg-teal-600 transition-all" />
                    </div>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-100 text-red-800 rounded-md">{error}</div>}
              </div>
            )}

            {/* STEP: Search (visible when step === 'search' or 'analyze' - show controls in 'search') */}
            {(step === "search" || step === "analyze") && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-3">Step 1 — Search Articles</h2>

                <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Days back</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={daysBack}
                      onChange={(e) => setDaysBack(Number(e.target.value))}
                      className="ml-2 w-24 p-2 border rounded text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm">Max results</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={maxResults}
                      onChange={(e) => setMaxResults(Number(e.target.value))}
                      className="ml-2 w-24 p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <button
                      onClick={searchArticles}
                      disabled={searching}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md text-white disabled:opacity-50 transition-shadow shadow-sm"
                    >
                      {searching ? "Searching..." : "Search Articles"}
                    </button>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-100 text-red-800 rounded-md mb-4">{error}</div>}

                {/* Show search results when available */}
                {searchResults.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Search Results</h3>
                    <div className="grid gap-2">
                      {searchResults.map((a, i) => (
                        <div key={i} className="p-3 border rounded bg-gray-50 flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedArticles.includes(i)}
                            onChange={() => toggleArticleSelection(i)}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-semibold">{a.title}</div>
                            <div className="text-sm text-gray-600">{a.snippet || a.link}</div>
                            <a href={a.link} target="_blank" rel="noreferrer" className="text-xs text-teal-600">Open</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP: Analyze (visible when step === 'analyze') */}
            {step === "analyze" && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-3">Step 2 — Analyze Selected Articles</h2>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={analyzeArticles}
                    disabled={analyzing}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md text-white disabled:opacity-50 transition-shadow shadow-sm"
                  >
                    {analyzing ? "Analyzing..." : "Analyze Articles"}
                  </button>

                  <button
                    onClick={() => {
                      // let user re-run search
                      setStep("search");
                      setAnalysisResult(null);
                    }}
                    className="px-4 py-2 bg-white border rounded-md text-gray-700 shadow-sm"
                  >
                    Back to Search
                  </button>
                </div>

                {analysisResult && (
                  <div className="mt-4 p-4 bg-green-50 rounded">
                    <div className="font-semibold mb-2">Analysis Result</div>
                    <div><strong>Articles analyzed:</strong> {analysisResult.articles_analyzed}</div>
                    <div><strong>Alerts created:</strong> {analysisResult.alerts_created}</div>

                    {Array.isArray(analysisResult.alerts) && analysisResult.alerts.length > 0 && (
                      <div className="mt-3">
                        <div className="font-medium">Alerts</div>
                        <ul className="list-disc list-inside text-sm">
                          {analysisResult.alerts.map((al, idx) => (
                            <li key={idx}>{al.title} — <span className="text-xs text-gray-600">{al.priority || 'N/A'}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.message && <div className="mt-2 text-sm text-gray-700">{analysisResult.message}</div>}
                  </div>
                )}

                {error && <div className="p-3 bg-red-100 text-red-800 rounded-md mt-4">{error}</div>}
              </div>
            )}

            <div className="mt-6 text-xs text-gray-500 text-center w-full">Files are uploaded to the backend for processing. Make sure you are signed in.</div>
          </div>
        </main>
      </div>
    </div>
  );
}