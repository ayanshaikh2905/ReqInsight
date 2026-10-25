export function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8" role="status" aria-label="Loading page">
      <div className="skeleton h-8 w-56 rounded-md" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full rounded-md" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-14 rounded-xl" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    </div>
  );
}
