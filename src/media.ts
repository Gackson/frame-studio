export function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const timeout = setTimeout(() => fail(), 15000);
    const cleanup = () => {
      clearTimeout(timeout);
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
    };
    const fail = () => {
      cleanup();
      video.removeAttribute("src");
      video.load();
      reject(
        new Error("视频无法解码，请使用浏览器支持的 MP4（H.264）或 WebM。"),
      );
    };
    const finish = () => {
      if (
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        video.videoWidth === 0
      ) {
        fail();
        return;
      }
      cleanup();
      resolve(video);
    };
    video.onloadeddata = () => {
      video.onloadeddata = null;
      // Browser-recorded WebM can omit duration metadata. Seeking to the end lets
      // the decoder discover its finite duration before restoring the first frame.
      if (!Number.isFinite(video.duration)) {
        video.onseeked = () => {
          if (!Number.isFinite(video.duration)) {
            fail();
            return;
          }
          video.onseeked = finish;
          video.currentTime = 0;
        };
        video.currentTime = 1e10;
      } else finish();
    };
    video.onerror = fail;
    video.src = url;
  });
}
export function releaseVideo(v: HTMLVideoElement) {
  v.pause();
  v.removeAttribute("src");
  v.load();
}
