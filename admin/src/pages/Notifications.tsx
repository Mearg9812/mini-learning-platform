import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  LoaderCircle,
  Send,
  Smartphone,
} from "lucide-react";
import api from "../api/axios";

export default function Notifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    isError: boolean;
    isWarning?: boolean;
  } | null>(null);

  const sendNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setIsSending(true);
    try {
      const response = await api.post("/notify", { title, body: message });
      setNotice({
        text: response.data.message || "Notification sent to the app.",
        isError: false,
        isWarning: response.data.pushSent === false,
      });
      setTitle("");
      setMessage("");
    } catch (error: unknown) {
      const responseError = (
        error as { response?: { data?: { error?: string } } }
      )?.response?.data?.error;
      setNotice({
        text: responseError || "Could not send the notification. Try again.",
        isError: true,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">
          Audience updates
        </p>
        <h2 className="ui-page-title">Push notifications</h2>
        <p className="ui-page-description mt-1">
          Write an announcement and send it to students using the Mini Learning
          app.
        </p>
      </header>

      {notice && (
        <div
          role="status"
          className={`ui-alert ${notice.isError ? "ui-alert-error" : notice.isWarning ? "ui-alert-info" : "ui-alert-success"}`}
        >
          {notice.isError || notice.isWarning ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <form
          onSubmit={sendNotification}
          className="ui-card space-y-5 p-5 sm:p-7"
        >
          <div>
            <label htmlFor="notification-title" className="ui-label">
              Notification title
            </label>
            <input
              id="notification-title"
              className="ui-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="For example: New lessons are available"
              required
            />
            <p className="mt-1.5 text-right text-xs text-slate-400">
              {title.length}/120
            </p>
          </div>

          <div>
            <label htmlFor="notification-message" className="ui-label">
              Message
            </label>
            <textarea
              id="notification-message"
              className="ui-input min-h-48 resize-y leading-6"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={5000}
              placeholder="Write a clear message for students…"
              required
            />
            <p className="mt-1.5 text-right text-xs text-slate-400">
              {message.length}/5,000
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Notifications use plain text so the message reads consistently in
              the phone’s notification tray and inbox.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              This will be sent to all app devices subscribed to announcements.
            </p>
            <button
              type="submit"
              disabled={isSending || !title.trim() || !message.trim()}
              className="ui-button ui-button-primary min-h-11 shrink-0 px-5"
            >
              {isSending ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {isSending ? "Sending…" : "Send notification"}
            </button>
          </div>
        </form>

        <aside className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <BellRing size={17} className="text-indigo-500" /> Preview
          </div>
          <div className="rounded-[26px] border border-slate-200 bg-slate-900 p-4 shadow-xl shadow-slate-900/10">
            <div className="mb-3 flex items-center gap-2 px-1 text-[11px] font-medium text-slate-300">
              <Smartphone size={14} /> Mini Learning · now
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-white">
                  <BellRing size={12} />
                </span>{" "}
                Mini Learning
              </div>
              <p className="text-sm font-bold text-slate-900">
                {title.trim() || "Your notification title"}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700">
                {message.trim() ||
                  "Your message will appear here as students receive it."}
              </p>
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Students can also open the bell in the app to browse previous
            announcements.
          </p>
        </aside>
      </div>
    </div>
  );
}
