import type { Ref } from "react";

type CameraBubbleProps = {
  rootRef: Ref<HTMLDivElement>;
  videoRef: Ref<HTMLVideoElement>;
  visible: boolean;
};

export function CameraBubble({ rootRef, videoRef, visible }: CameraBubbleProps) {
  return (
    <div id="bubble" ref={rootRef} className={visible ? undefined : "hidden"}>
      <video ref={videoRef} autoPlay muted playsInline />
    </div>
  );
}
