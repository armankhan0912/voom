import { VOOM_APP_URL } from "../config";
import { sendVoomMessage } from "../runtime";

export function Popup() {
  function startRecording() {
    void sendVoomMessage({
      type: "voom-begin",
      source: "popup",
      autostart: true,
    });
    window.close();
  }

  return (
    <div className="w-44 p-3 font-sans">
      <button
        type="button"
        className="w-full rounded-lg bg-[#ff6b00] px-3 py-2 text-sm font-medium text-white hover:bg-[#e55f00]"
        onClick={startRecording}
      >
        Record screen
      </button>
      <p className="mt-2 text-center text-sm">
        <a
          className="text-[#ff6b00] hover:underline"
          href={`${VOOM_APP_URL}/`}
          target="_blank"
          rel="noreferrer"
        >
          Home
        </a>
      </p>
    </div>
  );
}
