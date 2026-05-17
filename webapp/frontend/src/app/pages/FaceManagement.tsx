import { useEffect, useState } from "react";
import { Plus, Trash2, UserRoundCheck } from "lucide-react";
import { addFace, deleteFace, listFaces, type FaceProfile } from "../api/faceApi";
import { FaceCamera } from "../components/FaceCamera";

export function FaceManagement() {
  const [faces, setFaces] = useState<FaceProfile[]>([]);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadFaces = async () => {
    try {
      setFaces(await listFaces());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách khuôn mặt.");
    }
  };

  useEffect(() => {
    loadFaces();
  }, []);

  const handleAddFace = async () => {
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Vui lòng nhập tên khuôn mặt.");
      return;
    }
    if (!image) {
      setError("Vui lòng chụp ảnh khuôn mặt.");
      return;
    }

    setLoading(true);
    try {
      await addFace(name.trim(), image);
      setName("");
      setImage("");
      setMessage("Đã thêm khuôn mặt thành công.");
      await loadFaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể thêm khuôn mặt.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFace = async (face: FaceProfile) => {
    if (!window.confirm(`Xóa khuôn mặt "${face.name}"?`)) {
      return;
    }

    setError("");
    setMessage("");
    try {
      await deleteFace(face.id);
      setMessage("Đã xóa khuôn mặt thành công.");
      await loadFaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa khuôn mặt.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Quản lý khuôn mặt</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">Thêm hoặc xóa khuôn mặt được phép đăng nhập YoloHome.</p>
        </div>
      </div>

      {(error || message) && (
        <div className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <UserRoundCheck className="h-6 w-6 text-[#6366f1]" />
            <h2 className="text-xl font-bold text-gray-800">Danh sách khuôn mặt</h2>
          </div>

          {faces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm font-medium text-gray-500">
              Chưa có khuôn mặt nào được đăng ký.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tên khuôn mặt</th>
                    <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                    <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {faces.map((face) => (
                    <tr key={face.id}>
                      <td className="px-4 py-3 font-semibold text-gray-800">{face.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {face.createdAt ? new Date(face.createdAt).toLocaleString("vi-VN") : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteFace(face)}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <Plus className="h-6 w-6 text-[#6366f1]" />
            <h2 className="text-xl font-bold text-gray-800">Thêm khuôn mặt</h2>
          </div>

          <label className="mb-2 block text-sm font-semibold text-gray-700">Tên khuôn mặt</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Ba, Mẹ, Chủ nhà"
            className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm font-medium text-gray-800 outline-none transition focus:border-[#6366f1] focus:bg-white focus:ring-2 focus:ring-[#6366f1]/20"
          />

          <FaceCamera onCapture={setImage} captureLabel={image ? "Chụp lại" : "Chụp khuôn mặt"} disabled={loading} />

          {image && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <img src={image} alt="Ảnh khuôn mặt đã chụp" className="aspect-video w-full object-cover" />
            </div>
          )}

          <button
            type="button"
            onClick={handleAddFace}
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
          >
            {loading ? "Đang thêm khuôn mặt..." : "Thêm khuôn mặt"}
          </button>
        </section>
      </div>
    </div>
  );
}
