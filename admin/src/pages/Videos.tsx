import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import api from "../api/axios";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Film,
  LoaderCircle,
  RefreshCw,
  Search,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";

interface Video {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  thumbnail: string;
  activeSource: "YOUTUBE" | "CLOUDFLARE";
  course: string;
}

type MessageKind = "info" | "success" | "error";

const categories = ["Education", "Entertainment", "Technology"];
const courses = [
  ["FREE_FOR_ALL", "Free for all"],
  ["GRADE_9", "9th grade"],
  ["GRADE_10", "10th grade"],
  ["GRADE_11", "11th grade"],
  ["GRADE_12", "12th grade"],
  ["FRESHMAN", "Freshman"],
];
const PAGE_SIZE = 6;
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

export default function Videos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [thumbnail, setThumbnail] = useState("");
  const [duration, setDuration] = useState(0);
  const [activeSource, setActiveSource] = useState<"YOUTUBE" | "CLOUDFLARE">(
    "YOUTUBE",
  );
  const [course, setCourse] = useState("GRADE_9");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const videoFileInput = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [videosError, setVideosError] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("info");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState<
    "ALL" | Video["activeSource"]
  >("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      !normalizedSearch ||
      `${video.title} ${video.description} ${video.category}`
        .toLowerCase()
        .includes(normalizedSearch);
    const matchesCategory =
      categoryFilter === "ALL" || video.category === categoryFilter;
    const matchesSource =
      sourceFilter === "ALL" || video.activeSource === sourceFilter;
    return matchesSearch && matchesCategory && matchesSource;
  });
  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const paginatedVideos = filteredVideos.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const showMessage = (text: string, kind: MessageKind) => {
    setMessage(text);
    setMessageKind(kind);
  };

  const loadVideos = useCallback(async () => {
    setIsLoadingVideos(true);
    setVideosError("");
    try {
      const response = await api.get("/videos");
      setVideos(response.data);
    } catch (error) {
      console.error("Failed to load videos", error);
      setVideosError(
        "We could not load the video library. Check your connection and try again.",
      );
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const handleFetchYouTube = async () => {
    const videoId =
      youtubeUrl.split("v=")[1]?.substring(0, 11) ||
      youtubeUrl.split("youtu.be/")[1]?.substring(0, 11);
    if (!videoId) {
      showMessage("Enter a valid YouTube video URL first.", "error");
      return;
    }

    setIsFetchingDetails(true);
    showMessage("Fetching video details from YouTube…", "info");
    try {
      const response = await api.post("/youtube-info", { videoId });
      setTitle(response.data.title);
      setDescription(response.data.description);
      setThumbnail(response.data.thumbnail);
      setDuration(response.data.durationSeconds);
      showMessage("Video details are ready to review.", "success");
    } catch (error: any) {
      showMessage(
        error.response?.data?.error ||
          "Could not fetch this YouTube video. Check the link and try again.",
        "error",
      );
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleSaveVideo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      showMessage("Choose an MP4 video file before saving.", "error");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      showMessage("Preparing your secure upload…", "info");
      const ticketResponse = await api.post("/upload-url", {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
      });
      const { uploadUrl, cloudflareUrl } = ticketResponse.data;

      showMessage("Uploading video to Cloudflare…", "info");
      await axios.put(uploadUrl, selectedFile, {
        headers: { "Content-Type": selectedFile.type },
        onUploadProgress: (event) => {
          if (event.total)
            setUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
      });

      showMessage("Saving video details…", "info");
      await api.post("/videos", {
        title,
        description,
        category,
        duration,
        thumbnail,
        youtubeUrl,
        cloudflareUrl,
        activeSource,
        course,
      });

      showMessage("Your video has been added to the library.", "success");
      setYoutubeUrl("");
      setTitle("");
      setDescription("");
      setCategory(categories[0]);
      setThumbnail("");
      setDuration(0);
      setActiveSource("YOUTUBE");
      setCourse("GRADE_9");
      setSelectedFile(null);
      if (videoFileInput.current) videoFileInput.current.value = "";
      setUploadProgress(0);
      setCurrentPage(1);
      await loadVideos();
    } catch (error: any) {
      console.error("Failed to save video", error);
      showMessage(
        error.response?.data?.error ||
          "The video could not be saved. Please try again.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSource = async (video: Video) => {
    const newSource =
      video.activeSource === "YOUTUBE" ? "CLOUDFLARE" : "YOUTUBE";
    try {
      await api.patch(`/videos/${video.id}/source`, {
        activeSource: newSource,
      });
      showMessage(
        `Playback source changed to ${newSource === "YOUTUBE" ? "YouTube" : "Cloudflare R2"}.`,
        "success",
      );
      await loadVideos();
    } catch (error: any) {
      showMessage(
        error.response?.data?.error || "Could not update the playback source.",
        "error",
      );
    }
  };

  const updateCourse = async (video: Video, nextCourse: string) => {
    try {
      await api.patch(`/videos/${video.id}/course`, { course: nextCourse });
      showMessage(`Course assignment updated for ${video.title}.`, "success");
      await loadVideos();
    } catch (error: any) {
      showMessage(
        error.response?.data?.error || "Could not update the video course.",
        "error",
      );
    }
  };

  const deleteVideo = async (video: Video) => {
    if (!window.confirm(`Delete “${video.title}” from the library?`)) return;
    try {
      await api.delete(`/videos/${video.id}`);
      showMessage("Video removed from the library.", "success");
      await loadVideos();
    } catch (error: any) {
      showMessage(
        error.response?.data?.error || "Could not delete this video.",
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">
            Content management
          </p>
          <h2 className="ui-page-title">Video library</h2>
          <p className="ui-page-description">
            Add, organize, and manage the videos available on your platform.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm sm:self-auto">
          <VideoIcon size={16} className="text-indigo-500" />
          {videos.length} {videos.length === 1 ? "video" : "videos"}
        </div>
      </header>

      {message && (
        <div
          role={messageKind === "error" ? "alert" : "status"}
          className={`ui-alert ${messageKind === "error" ? "ui-alert-error" : messageKind === "success" ? "ui-alert-success" : "ui-alert-info"}`}
        >
          {messageKind === "error" ? (
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
          ) : messageKind === "success" ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          ) : (
            <LoaderCircle
              size={18}
              className={`mt-0.5 shrink-0 ${isSubmitting || isFetchingDetails ? "animate-spin" : ""}`}
            />
          )}
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <CloudUpload size={19} />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Add a video
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Provide both playback sources and details.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveVideo} className="space-y-5 p-5 sm:p-6">
            <div>
              <label htmlFor="youtubeUrl" className="ui-label">
                YouTube link{" "}
                <span className="font-normal text-slate-400">· optional</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <VideoIcon
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500"
                  />
                  <input
                    id="youtubeUrl"
                    type="url"
                    placeholder="https://youtube.com/watch?v=…"
                    className="ui-input has-leading-icon"
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleFetchYouTube()}
                  disabled={isFetchingDetails || !youtubeUrl.trim()}
                  className="ui-button ui-button-secondary shrink-0"
                >
                  {isFetchingDetails ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : null}{" "}
                  Fetch details
                </button>
              </div>
            </div>

            {thumbnail && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img
                  src={thumbnail}
                  alt="Video thumbnail preview"
                  className="h-40 w-full object-cover sm:h-44"
                />
              </div>
            )}

            <div>
              <label htmlFor="videoTitle" className="ui-label">
                Video title
              </label>
              <input
                id="videoTitle"
                required
                type="text"
                placeholder="e.g. Introduction to algebra"
                className="ui-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="videoDescription" className="ui-label">
                Description
              </label>
              <textarea
                id="videoDescription"
                required
                placeholder="What will learners take away from this video?"
                className="ui-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="videoCategory" className="ui-label">
                  Category
                </label>
                <select
                  id="videoCategory"
                  className="ui-input"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {categories.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="videoDuration" className="ui-label">
                  Duration{" "}
                  <span className="font-normal text-slate-400">(seconds)</span>
                </label>
                <input
                  id="videoDuration"
                  required
                  min={1}
                  type="number"
                  className="ui-input"
                  value={duration || ""}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="videoCourse" className="ui-label">
                Course access
              </label>
              <select
                id="videoCourse"
                required
                className="ui-input"
                value={course}
                onChange={(event) => setCourse(event.target.value)}
              >
                {courses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {value === "FREE_FOR_ALL" ? label : `${label} full course`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Free for all videos are available to every student. Other videos
                require an approved purchase for that course.
              </p>
            </div>

            <div>
              <label htmlFor="videoFile" className="ui-label">
                Video file{" "}
                <span className="font-normal text-slate-400">· MP4</span>
              </label>
              <label
                htmlFor="videoFile"
                className={`flex min-h-[92px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center transition ${selectedFile ? "border-indigo-300 bg-indigo-50/60" : "border-slate-300 bg-slate-50/70 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
              >
                <CloudUpload
                  size={21}
                  className={
                    selectedFile
                      ? "mb-1 text-indigo-600"
                      : "mb-1 text-slate-400"
                  }
                />
                <span className="text-sm font-semibold text-slate-700">
                  {selectedFile ? selectedFile.name : "Choose an MP4 file"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB selected`
                    : "Select a file from your device"}
                </span>
                <input
                  ref={videoFileInput}
                  id="videoFile"
                  type="file"
                  accept="video/mp4"
                  required
                  className="sr-only"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] || null)
                  }
                />
              </label>
            </div>

            <fieldset>
              <legend className="ui-label">Default playback source</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["YOUTUBE", "CLOUDFLARE"] as const).map((source) => (
                  <label
                    key={source}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition ${activeSource === source ? "border-indigo-300 bg-indigo-50/70 text-indigo-800 ring-2 ring-indigo-500/10" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    <input
                      type="radio"
                      name="activeSource"
                      checked={activeSource === source}
                      onChange={() => setActiveSource(source)}
                      className="accent-indigo-600"
                    />
                    {source === "YOUTUBE" ? "YouTube" : "Cloudflare R2"}
                  </label>
                ))}
              </div>
            </fieldset>

            {isSubmitting && (
              <div aria-live="polite">
                <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500">
                  <span>Upload progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isFetchingDetails}
              className="ui-button ui-button-primary min-h-11 w-full"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" /> Saving
                  video…
                </>
              ) : (
                <>
                  <CloudUpload size={17} /> Add to video library
                </>
              )}
            </button>
          </form>
        </section>

        <section className="ui-card min-w-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Film size={19} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Your library
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Search and manage uploaded content.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadVideos()}
                disabled={isLoadingVideos}
                aria-label="Refresh videos"
                title="Refresh videos"
                className="rounded-lg border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={isLoadingVideos ? "animate-spin" : ""}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(120px,0.65fr)_minmax(145px,0.8fr)]">
              <label>
                <span className="ui-label">Search</span>
                <span className="relative block">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Title or description"
                    className="ui-input has-leading-icon"
                  />
                </span>
              </label>
              <label>
                <span className="ui-label">Category</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="ui-input"
                >
                  <option value="ALL">All categories</option>
                  {categories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="ui-label">Source</span>
                <select
                  value={sourceFilter}
                  onChange={(event) => {
                    setSourceFilter(event.target.value as typeof sourceFilter);
                    setCurrentPage(1);
                  }}
                  className="ui-input"
                >
                  <option value="ALL">All sources</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="CLOUDFLARE">Cloudflare R2</option>
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            {isLoadingVideos ? (
              <div className="space-y-3" aria-label="Loading videos">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="flex animate-pulse gap-4 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="h-20 w-28 rounded-lg bg-slate-100" />
                    <div className="flex-1 space-y-3 py-2">
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                      <div className="h-3 w-1/3 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : videosError ? (
              <div className="rounded-2xl border border-red-100 bg-red-50/70 px-5 py-8 text-center">
                <AlertCircle size={25} className="mx-auto mb-3 text-red-500" />
                <p className="text-sm font-semibold text-slate-800">
                  The library could not be loaded
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">
                  {videosError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadVideos()}
                  className="ui-button ui-button-secondary mt-4"
                >
                  <RefreshCw size={15} /> Try again
                </button>
              </div>
            ) : videos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-12 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <Film size={22} />
                </span>
                <p className="text-sm font-semibold text-slate-800">
                  Your library is ready
                </p>
                <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-slate-500">
                  Videos you add will appear here with their playback source and
                  category.
                </p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center">
                <Search size={22} className="mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-semibold text-slate-800">
                  No videos match these filters
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Try another search or clear the filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("ALL");
                    setSourceFilter("ALL");
                    setCurrentPage(1);
                  }}
                  className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              paginatedVideos.map((video) => (
                <article
                  key={video.id}
                  className="group flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3 transition hover:border-slate-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="relative h-36 shrink-0 overflow-hidden rounded-lg bg-slate-100 text-slate-300 sm:h-[76px] sm:w-28">
                    <Film
                      size={22}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    />
                    {video.thumbnail && (
                      <img
                        src={video.thumbnail}
                        alt={`${video.title} thumbnail`}
                        className="relative h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-slate-900">
                      {video.title}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {video.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {video.category}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
                        {courses.find(
                          ([value]) => value === video.course,
                        )?.[1] || "Unassigned"}
                      </span>
                      <span>{formatDuration(video.duration)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                    <select
                      aria-label={`Course for ${video.title}`}
                      value={video.course || "UNASSIGNED"}
                      onChange={(event) =>
                        void updateCourse(video, event.target.value)
                      }
                      className="max-w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      <option value="UNASSIGNED" disabled>
                        Unassigned
                      </option>
                      {courses.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void toggleSource(video)}
                      className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold transition ${video.activeSource === "YOUTUBE" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-orange-50 text-orange-700 hover:bg-orange-100"}`}
                      title="Change playback source"
                    >
                      {video.activeSource === "YOUTUBE"
                        ? "YouTube"
                        : "Cloudflare R2"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteVideo(video)}
                      aria-label={`Delete ${video.title}`}
                      title="Delete video"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {!isLoadingVideos && !videosError && filteredVideos.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-4 sm:px-5">
              <span className="text-xs font-medium text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(page - 1)}
                  disabled={page === 1}
                  className="ui-button ui-button-secondary min-h-9 px-3 py-1.5 text-xs"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(page + 1)}
                  disabled={page === totalPages}
                  className="ui-button ui-button-secondary min-h-9 px-3 py-1.5 text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
