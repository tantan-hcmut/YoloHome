export function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-[#6366f1] border-t-transparent" />
        <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
      </div>
    </div>
  );
}
