export default function PageLoader() {
  return (
    <div role="status" aria-label="Cargando" className="flex min-h-[50vh] items-center justify-center">
      <div className="h-[3px] w-24 overflow-hidden bg-border">
        <div className="h-full w-1/3 animate-[ticker_1s_linear_infinite] bg-brand motion-reduce:animate-none" />
      </div>
    </div>
  );
}
