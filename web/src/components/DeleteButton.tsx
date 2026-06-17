'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    const confirmed = window.confirm('Bạn có chắc chắn muốn xoá bài kiểm tra này không? Thao tác này không thể hoàn tác.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/results/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        // Làm mới trang Dashboard để cập nhật danh sách
        router.refresh();
      } else {
        alert('Có lỗi xảy ra khi xoá bài kiểm tra.');
      }
    } catch (error) {
      console.error('Lỗi khi xoá:', error);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 transition-colors ml-4"
      title="Xoá bài kiểm tra"
    >
      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      <span>Xoá</span>
    </button>
  );
}
