import {
    GROUPS,
    MSLQGroupKey,
    BAND_RANGES,
    LEVELS_POSITIVE,
    LEVELS_ANXIETY,
    TIER_COLOR_POSITIVE,
    TIER_COLOR_ANXIETY
} from './groups';

export interface GroupResult {
    key: MSLQGroupKey;
    name: string;
    reversed: boolean;
    total: number;
    max: number;
    count: number;
    avg: number;
    tier: number;
    level: string;
    color: string;
    desc: string;
    range: string;
}

export function getTierFromAvg(avg: number): number {
    if (avg <= 2.0) return 0;
    if (avg <= 3.0) return 1;
    if (avg <= 4.0) return 2;
    return 3;
}

export function texEscape(s: string): string {
    const repl: Record<string, string> = {
        "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$",
        "#": "\\#", "_": "\\_", "{": "\\{", "}": "\\}",
        "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
    };
    return s.replace(/[\\&%$#_{}~^]/g, (c) => repl[c] || c);
}

export function grade(studentAnswers: number[]): GroupResult[] {
    if (studentAnswers.length !== 44) {
        throw new Error("Bài test phải có đúng 44 câu trả lời");
    }
    if (studentAnswers.some(a => a < 1 || a > 5)) {
        throw new Error("Mỗi đáp án phải nằm trong khoảng 1-5");
    }

    const results: GroupResult[] = [];
    for (const g of GROUPS) {
        const total = g.questions.reduce((sum: number, q: number) => sum + studentAnswers[q - 1], 0);
        const count = g.questions.length;
        const avg = total / count;
        const tier = getTierFromAvg(avg);
        
        let level = '';
        let color = '';
        if (g.reversed) {
            level = LEVELS_ANXIETY[tier];
            color = TIER_COLOR_ANXIETY[tier];
        } else {
            level = LEVELS_POSITIVE[tier];
            color = TIER_COLOR_POSITIVE[tier];
        }

        results.push({
            key: g.key,
            name: g.name,
            reversed: g.reversed,
            total,
            max: g.max,
            count,
            avg,
            tier,
            level,
            color,
            desc: g.desc[tier],
            range: BAND_RANGES[tier],
        });
    }
    return results;
}

export function buildStrengths(results: GroupResult[]): string[] {
    const items: string[] = [];
    for (const r of results) {
        if (!r.reversed && r.tier === 3) {
            items.push(`${r.name}: ${r.desc}`);
        }
        if (r.reversed && r.tier === 0) {
            items.push(`Tâm lý phòng thi vững vàng - ${r.desc}`);
        }
    }
    if (items.length === 0) {
        const positiveResults = results.filter(r => !r.reversed);
        const best = positiveResults.reduce((prev, curr) => (curr.avg > prev.avg ? curr : prev));
        items.push(`Điểm sáng tương đối: ${best.name} (trung bình ${best.avg.toFixed(1)} - ${best.level}).`);
    }
    return items;
}

export function buildImprovements(results: GroupResult[]): string[] {
    const items: string[] = [];
    for (const r of results) {
        if (!r.reversed && (r.tier === 0 || r.tier === 1)) {
            const tag = r.tier === 0 ? "ƯU TIÊN trong 4 tuần đầu" : "cần hỗ trợ";
            items.push(`${r.name} (${tag}): ${r.desc}`);
        }
        if (r.reversed && r.tier >= 2) {
            items.push(`Lo âu khi kiểm tra (${r.level} - cần lưu ý với phụ huynh và giáo viên): ${r.desc}`);
        }
    }
    if (items.length === 0) {
        items.push("Chưa có nhóm nào ở mức báo động. Con đang phát triển khá cân bằng, tiếp tục duy trì và nâng dần các nhóm ở mức Khá lên Tốt.");
    }
    return items;
}

export function buildOverallComment(results: GroupResult[]): string {
    const byKey = results.reduce((acc, r) => {
        acc[r.key] = r;
        return acc;
    }, {} as Record<string, GroupResult>);

    const strong = results.filter(r => !r.reversed && r.tier === 3).map(r => r.name);
    const weak = results.filter(r => !r.reversed && (r.tier === 0 || r.tier === 1)).map(r => r.name);
    const anxiety = byKey["test_anxiety"];

    const parts: string[] = [];
    if (strong.length > 0) {
        parts.push("Con có nền tảng tốt ở nhóm " + strong.join(", ").toLowerCase() + ".");
    }
    if (weak.length > 0) {
        parts.push("Nhóm cần được quan tâm nhiều hơn là " + weak.join(", ").toLowerCase() + ".");
    }
    if (strong.length === 0 && weak.length === 0) {
        parts.push("Các chỉ số của con khá đồng đều, phần lớn ở mức Khá.");
    }

    if (anxiety.tier >= 2) {
        parts.push(`Đặc biệt, mức lo âu khi kiểm tra đang ở ngưỡng ${anxiety.level.toLowerCase()} - đây là yếu tố tâm lý cần được ưu tiên tháo gỡ vì có thể khiến con làm bài dưới khả năng thực tế.`);
    } else if (anxiety.tier === 1) {
        parts.push("Mức lo âu khi kiểm tra ở ngưỡng trung bình, nằm trong tầm kiểm soát.");
    } else {
        parts.push("Con giữ được tâm lý khá thoải mái khi làm bài kiểm tra.");
    }

    return parts.join(" ");
}

const NEW_SOLUTIONS: Record<string, {title: string, desc: string}[]> = {
    "self_efficacy": [
        { title: "Áp dụng bài toán thực tế (Contextual Learning)", desc: "Tuyệt đối không dạy lý thuyết suông. Bắt đầu buổi học bằng một tình huống thực tế hoặc một nghịch lý đời sống liên quan đến bài học để kích thích sự tò mò (Ví dụ: Dạy về tỷ lệ phần trăm thông qua bài toán tính tiền giảm giá Shopee hoặc lãi suất mua trả góp điện thoại)." },
        { title: "Cung cấp quyền lựa chọn (Autonomy)", desc: "Cho học sinh quyền tự chọn cách hoàn thành nhiệm vụ khi có thể. Thay vì bắt buộc làm một dạng bài tập duy nhất, cho phép các em chọn làm bài tập cá nhân, làm dự án nhỏ theo nhóm, hoặc thuyết trình giải thích lại bài toán đó." },
        { title: "Kết nối liên môn", desc: "Chỉ ra mối liên hệ giữa môn học này với các môn học khác mà học sinh thích (ví dụ: Toán học bổ trợ như thế nào cho việc lập trình game hoặc tính toán trong môn Địa lý)." }
    ],
    "intrinsic_value": [
        { title: "Thiết kế trải nghiệm chiến thắng (Mastery Experiences)", desc: "Hạ độ khó của bài tập xuống mức học sinh chắc chắn làm được để tạo “Quick Wins” (chiến thắng nhanh). Cảm giác giải được bài sẽ kích hoạt dopamine, giúp xóa bỏ tâm lý sợ hãi và xây dựng lại sự tự tin từ gốc." },
        { title: "Chia nhỏ bậc thang kiến thức (Scaffolding)", desc: "Một bài toán lớn gồm 4 bước thì giáo viên hỗ trợ làm 3 bước đầu, để học sinh tự làm bước cuối cùng. Sau đó tăng dần để học sinh tự làm 2 bước, rồi tự làm cả bài." },
        { title: "Thay đổi cách khen ngợi", desc: "Tuyệt đối không khen “Con thông minh quá“. Hãy khen vào giải pháp và quá trình: “Thầy thấy cách con phân tích sơ đồ ở bước 2 rất logic”, hoặc “Bài này con đã kiên trì thử đến cách giải thứ 3, xuất sắc!“. Điều này giúp hình thành tư duy phát triển (Growth Mindset)." }
    ],
    "test_anxiety": [
        { title: "Giải mẫn cảm bằng thi thử (Desensitization)", desc: "Tổ chức các bài kiểm tra ngắn (Quiz 5–10 phút) không lấy điểm số áp lực, diễn ra thường xuyên để học sinh quen với cảm giác làm bài dưới áp lực thời gian. Giảm bớt sức nặng của điểm số thi học kỳ bằng cách chia nhỏ trọng số điểm sang chuyên cần, bài tập tuần, dự án." },
        { title: "Huấn luyện kỹ năng phòng thi", desc: "Dạy học sinh chiến thuật làm bài: “Dễ làm trước, khó làm sau; nếu kẹt quá 2 phút ở một câu thì đánh dấu để đó và chuyển câu tiếp theo”." },
        { title: "Bài tập thở và giải tỏa kiểm soát", desc: "Hướng dẫn kỹ thuật thở bụng (Box Breathing) 4 nhịp trước khi giám thị phát đề để hạ nhịp tim và làm dịu hệ thần kinh thực vật." }
    ],
    "cognitive_strategy": [
        { title: "Dạy phương pháp hệ thống hóa", desc: "Giáo viên không chỉ dạy kiến thức mà phải dạy “Cách học”. Hướng dẫn học sinh cách vẽ sơ đồ tư duy (Mindmap), kẻ bảng so sánh các công thức dễ nhầm lẫn, hoặc cách ghi chép theo phương pháp Cornell." },
        { title: "Yêu cầu học sinh chủ động xử lý thông tin", desc: "Cuối buổi học, thay vì thầy cô tóm tắt, hãy yêu cầu học sinh: “Hãy tóm tắt lại nội dung hôm nay bằng đúng 3 câu theo ngôn ngữ của con” hoặc “Hãy giảng lại bài toán này cho bạn bên cạnh nghe”. Học bằng cách dạy lại cho người khác (Kỹ thuật Feynman) là cách tốt nhất để phá vỡ thói quen học vẹt." },
        { title: "Khuyến khích tìm giải pháp thay thế", desc: "Đặt câu hỏi: “Bài này ngoài cách giải của thầy, bạn nào có thể tìm thêm một con đường khác để đi đến kết quả không?“." }
    ],
    "self_regulation": [
        { title: "Kế hoạch hành động trực quan (Action Planning)", desc: "Hướng dẫn học sinh lập danh sách việc cần làm (To-do list) cực kỳ cụ thể cho từng buổi học, thay vì mục tiêu chung chung. Ví dụ: Sửa “Hôm nay học Toán” thành “Hôm nay giải đúng 5 bài tập hình học trang 12 trong vòng 45 phút”." },
        { title: "Kiểm soát môi trường (Environment Control)", desc: "Hướng dẫn các em thiết lập góc học tập “sạch xao nhãng”: Cất điện thoại sang phòng khác, tắt tivi, dọn sạch bàn học trước khi ngồi vào bàn." },
        { title: "Dạy kỹ năng tự giám sát (Self-Monitoring)", desc: "Sử dụng các công cụ như đồng hồ đếm ngược Pomodoro (học 25 phút, nghỉ 5 phút) để giúp học sinh tự nhận thức và giới hạn thời gian tập trung của mình, tránh việc ngồi lướt điện thoại vô thức khi gặp bài tập khó." }
    ]
};

export function buildKhuyenNghi(results: GroupResult[]): string {
    const targets = results.filter(r => (!r.reversed && r.tier <= 1) || (r.reversed && r.tier >= 2));
    
    if (targets.length === 0) {
        return "Hiện tại học sinh đang duy trì phong độ rất tốt ở tất cả các khía cạnh. Phụ huynh và giáo viên tiếp tục đồng hành, ghi nhận nỗ lực và khích lệ để con duy trì động lực học tập tích cực này.";
    }

    const out: string[] = [];
    out.push("\\begin{itemize}");
    for (const t of targets) {
        out.push(`  \\item \\textbf{${texEscape(t.name)}}`);
        out.push("  \\begin{itemize}");
        const sols = NEW_SOLUTIONS[t.key] || [];
        for (const sol of sols) {
            out.push(`    \\item \\textbf{${texEscape(sol.title)}:} ${texEscape(sol.desc)}`);
        }
        out.push("  \\end{itemize}");
    }
    out.push("\\end{itemize}");
    return out.join("\n");
}

function _thucTrangRows(results: GroupResult[]): string {
    return results.map(r => {
        const diemHs = `\\textbf{${r.total} / ${r.max}}\\quad{\\small\\color{muted}TB ${r.avg.toFixed(1)}}\\quad\\pill{${r.color}}{${texEscape(r.level)}}`;
        return `${texEscape(r.name)} & ${r.max} & ${diemHs} \\\\ \\hline`;
    }).join("\n");
}

function _bulletList(items: string[]): string {
    const out = [];
    out.push("\\begin{itemize}");
    for (const it of items) {
        out.push("  \\item " + texEscape(it));
    }
    out.push("\\end{itemize}");
    return out.join("\n");
}

export function buildReportPayload(studentInfo: {name?: string, dob?: string}, results: GroupResult[]): Record<string, string> {
    return {
        "__STUDENT_NAME__": texEscape(studentInfo.name || ""),
        "__STUDENT_DOB__": texEscape(studentInfo.dob || ""),
        "__THUC_TRANG_ROWS__": _thucTrangRows(results),
        "__DIEM_TOT__": _bulletList(buildStrengths(results)),
        "__DIEM_CAI_THIEN__": _bulletList(buildImprovements(results)),
        "__NHAN_XET_CHUNG__": texEscape(buildOverallComment(results)),
        "__KHUYEN_NGHI__": buildKhuyenNghi(results),
    };
}
