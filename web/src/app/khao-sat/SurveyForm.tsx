'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { QUESTIONS, SCALE } from '@/lib/mslq/questions';

const EMPTY = () => Array<number | null>(QUESTIONS.length).fill(null);

export default function SurveyForm({ needsPin }: { needsPin: boolean }) {
    const [studentCode, setStudentCode] = useState('');
    const [round, setRound] = useState<1 | 2 | null>(null);
    const [studentName, setStudentName] = useState('');
    const [pin, setPin] = useState('');
    const [answers, setAnswers] = useState<(number | null)[]>(EMPTY);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const infoRef = useRef<HTMLDivElement | null>(null);

    const answered = answers.filter((a) => a !== null).length;
    const infoOk = /^\d{3}$/.test(studentCode) && round !== null && (!needsPin || pin.trim() !== '');

    const choose = (qi: number, v: number) => {
        setAnswers((prev) => {
            const next = [...prev];
            next[qi] = v;
            return next;
        });
    };

    const reset = () => {
        setStudentCode('');
        setRound(null);
        setStudentName('');
        setAnswers(EMPTY());
        setError(null);
        setDone(false);
        window.scrollTo({ top: 0 });
    };

    const submit = async () => {
        setError(null);
        if (!infoOk) {
            setError('Điền Mã học sinh (3 chữ số) và chọn Lần khảo sát trước khi nộp.');
            infoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const firstMissing = answers.findIndex((a) => a === null);
        if (firstMissing !== -1) {
            setError(`Em chưa trả lời câu ${firstMissing + 1}.`);
            questionRefs.current[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/survey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentCode, round, studentName, pin, answers }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Nộp bài không thành công, thử lại sau.');
            setDone(true);
            window.scrollTo({ top: 0 });
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                    <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-gray-900">Đã nộp xong, cảm ơn em!</h1>
                    <p className="text-gray-600 mt-2">
                        Mã {studentCode} · Lần {round}. Thầy cô sẽ dùng kết quả để hiểu cách học của em.
                    </p>
                    <button
                        onClick={reset}
                        className="mt-6 w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700"
                    >
                        Làm phiếu cho bạn khác
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 pb-32">
            <div className="max-w-2xl mx-auto px-4 pt-8">
                <h1 className="text-2xl font-bold text-gray-900">Khảo sát động lực và cách học môn Toán</h1>
                <p className="text-gray-600 mt-2">
                    Phiếu này <strong>không tính điểm</strong> và không có câu trả lời đúng hay sai. Với mỗi câu,
                    hãy chọn mức đúng nhất với bản thân em.
                </p>

                <div ref={infoRef} className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <div>
                        <label htmlFor="code" className="block text-sm font-medium text-gray-800">
                            Mã học sinh <span className="text-red-600">*</span>
                        </label>
                        <input
                            id="code"
                            inputMode="numeric"
                            maxLength={3}
                            value={studentCode}
                            onChange={(e) => setStudentCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="Ví dụ 107"
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Số đầu là lớp, hai số sau là số thứ tự thầy cô phát.</p>
                    </div>

                    <div>
                        <span className="block text-sm font-medium text-gray-800">
                            Lần khảo sát <span className="text-red-600">*</span>
                        </span>
                        <div className="mt-1 grid grid-cols-2 gap-3">
                            {([1, 2] as const).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRound(r)}
                                    aria-pressed={round === r}
                                    className={`rounded-xl border py-3 font-medium ${
                                        round === r
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'
                                    }`}
                                >
                                    Lần {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-800">
                            Họ và tên <span className="text-gray-400 font-normal">(không bắt buộc)</span>
                        </label>
                        <input
                            id="name"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {needsPin && (
                        <div>
                            <label htmlFor="pin" className="block text-sm font-medium text-gray-800">
                                Mã PIN của buổi khảo sát <span className="text-red-600">*</span>
                            </label>
                            <input
                                id="pin"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                    <p className="text-sm font-medium text-indigo-900 mb-2">Thang mức độ</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-sm">
                        {SCALE.map((s) => (
                            <li key={s.value} className="flex sm:flex-col items-center sm:text-center gap-2 sm:gap-1">
                                <span className="w-7 h-7 shrink-0 rounded-full bg-white border border-indigo-300 flex items-center justify-center font-semibold text-indigo-700">
                                    {s.value}
                                </span>
                                <span className="text-gray-800 leading-tight">{s.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <ol className="mt-6 space-y-3">
                    {QUESTIONS.map((q, qi) => (
                        <li key={qi}>
                            <div
                                ref={(el) => {
                                    questionRefs.current[qi] = el;
                                }}
                                className={`bg-white rounded-2xl border p-4 ${
                                    answers[qi] === null ? 'border-gray-200' : 'border-indigo-200'
                                }`}
                            >
                                <p className="text-gray-900">
                                    <span className="font-semibold text-indigo-700 mr-1">Câu {qi + 1}.</span>
                                    {q}
                                </p>
                                <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label={`Câu ${qi + 1}`}>
                                    {SCALE.map((s) => {
                                        const selected = answers[qi] === s.value;
                                        return (
                                            <button
                                                key={s.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                title={s.label}
                                                onClick={() => choose(qi, s.value)}
                                                className={`h-11 rounded-xl border text-base font-semibold transition-colors ${
                                                    selected
                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                        : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'
                                                }`}
                                            >
                                                {s.value}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    {error && (
                        <p className="flex items-start gap-2 text-sm text-red-700 mb-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            {error}
                        </p>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <div className="text-sm text-gray-700">
                                Đã trả lời <strong>{answered}</strong>/{QUESTIONS.length}
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div
                                    className="h-full bg-indigo-600 transition-all"
                                    style={{ width: `${(answered / QUESTIONS.length) * 100}%` }}
                                />
                            </div>
                        </div>
                        <button
                            onClick={submit}
                            disabled={submitting}
                            className="rounded-xl bg-indigo-600 text-white px-6 py-3 font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                        >
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Nộp bài
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
