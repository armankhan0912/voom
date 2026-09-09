export function VideoPlayer({ src, title }: { src: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-black">
      <video
        className="aspect-video w-full"
        src={src}
        controls
        playsInline
        title={title}
      />
    </div>
  );
}
