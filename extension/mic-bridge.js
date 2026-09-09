const VOOM_MIC_CHANNEL = "voom-mic-rtc";

function voomMicAudioConstraints() {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

async function voomGetLocalMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: voomMicAudioConstraints(),
    video: false,
  });
}

function voomSubscribeMic(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection();
    const ch = new BroadcastChannel(VOOM_MIC_CHANNEL);
    let settled = false;

    function finish(stream) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (!stream) {
        pc.close();
        ch.close();
      }
      resolve(stream || null);
    }

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream(event.track ? [event.track] : []);
      finish(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ch.postMessage({ type: "ice-answer", candidate: event.candidate.toJSON() });
      }
    };

    ch.onmessage = async (event) => {
      const msg = event.data;
      try {
        if (msg?.type === "offer" && msg.sdp) {
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ch.postMessage({ type: "answer", sdp: pc.localDescription });
        }
        if (msg?.type === "ice-offer" && msg.candidate) {
          await pc.addIceCandidate(msg.candidate);
        }
      } catch {
        // Overlay may still be opening the mic.
      }
    };

    ch.postMessage({ type: "need-mic" });
  });
}

function voomPublishMic() {
  let pc = null;
  let ch = null;
  let stream = null;
  let running = false;

  async function publishOffer() {
    if (!pc || !ch) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ch.postMessage({ type: "offer", sdp: pc.localDescription });
  }

  async function start() {
    if (running) return;
    running = true;
    try {
      stream = await voomGetLocalMic();
      pc = new RTCPeerConnection();
      ch = new BroadcastChannel(VOOM_MIC_CHANNEL);
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ch.postMessage({ type: "ice-offer", candidate: event.candidate.toJSON() });
        }
      };

      ch.onmessage = async (event) => {
        const msg = event.data;
        try {
          if (msg?.type === "need-mic" || msg?.type === "mic-ok") {
            if (msg.type === "mic-ok") {
              stop();
              return;
            }
            await publishOffer();
          }
          if (msg?.type === "answer" && msg.sdp && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(msg.sdp);
          }
          if (msg?.type === "ice-answer" && msg.candidate) {
            await pc.addIceCandidate(msg.candidate);
          }
        } catch {
          // Recorder may connect after a late overlay mount.
        }
      };

      await publishOffer();
    } catch {
      running = false;
      stop();
    }
  }

  function stop() {
    running = false;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    try {
      pc?.close();
    } catch {
      // Already closed.
    }
    pc = null;
    try {
      ch?.close();
    } catch {
      // Already closed.
    }
    ch = null;
  }

  return { start, stop };
}
