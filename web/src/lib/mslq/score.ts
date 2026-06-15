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

export function buildRoadmap(results: GroupResult[]): [string, string][] {
    const byKey = results.reduce((acc, r) => {
        acc[r.key] = r;
        return acc;
    }, {} as Record<string, GroupResult>);

    const priority = results.filter(r => !r.reversed && r.tier === 0);
    const support = results.filter(r => !r.reversed && r.tier === 1);
    const okay = results.filter(r => !r.reversed && r.tier === 2);
    const anxiety = byKey["test_anxiety"];

    const names = (lst: GroupResult[]) => lst.map(r => r.name.toLowerCase()).join(", ");

    const gd1: string[] = [];
    if (anxiety.tier >= 2) {
        gd1.push("Ổn định tâm lý phòng thi: cho con làm các bài kiểm tra ngắn, áp lực thấp, tăng dần độ khó để con quen với cảm giác thi cử và bớt căng thẳng.");
    }
    if (priority.length > 0) {
        gd1.push(`Củng cố cấp thiết nhóm ${names(priority)} bằng các nhiệm vụ nhỏ, dễ đạt để con tạo lại 'chiến thắng nhỏ' và lấy lại niềm tin.`);
    }
    if (gd1.length === 0) {
        let target = support[0];
        if (!target) {
            const positiveResults = results.filter(r => !r.reversed);
            target = positiveResults.reduce((prev, curr) => (curr.avg < prev.avg ? curr : prev));
        }
        gd1.push(`Rà soát và củng cố nền tảng ở nhóm ${target.name.toLowerCase()}, thiết lập thói quen học đều mỗi ngày.`);
    }
    const gd1Text = "Mục tiêu: " + gd1.join(" ");

    const gd2Targets = support.length > 0 ? support : okay;
    let gd2Text = "";
    if (gd2Targets.length > 0) {
        gd2Text = `Mục tiêu: Trang bị phương pháp học hiệu quả cho nhóm ${names(gd2Targets)}. Hướng dẫn con kỹ năng tóm tắt bài, vẽ sơ đồ, ghi chú lỗi sai và tự đặt câu hỏi kiểm tra mức độ hiểu.`;
    } else {
        gd2Text = "Mục tiêu: Duy trì phương pháp học tốt hiện có, bổ sung các kỹ thuật ghi nhớ và liên hệ kiến thức nâng cao.";
    }

    const gd3Text = "Mục tiêu: Rèn cho con khả năng tự lập kế hoạch, tự đặt mục tiêu và tự đánh giá tiến độ học. Nâng dần các nhóm đang ở mức Khá lên mức Tốt và duy trì thói quen học tập bền vững.";

    return [
        ["Giai đoạn 1 (Tuần 1-4)", gd1Text],
        ["Giai đoạn 2 (Tuần 5-8)", gd2Text],
        ["Giai đoạn 3 (Tuần 9-12)", gd3Text],
    ];
}

export function buildParentAdvice(results: GroupResult[]): string[] {
    const byKey = results.reduce((acc, r) => {
        acc[r.key] = r;
        return acc;
    }, {} as Record<string, GroupResult>);

    const advice: string[] = [];
    if (byKey["test_anxiety"].tier >= 2) {
        advice.push("Tránh tạo thêm áp lực điểm số; ghi nhận và động viên nỗ lực của con thay vì chỉ nhìn vào kết quả bài thi.");
    }
    if (byKey["self_efficacy"].tier <= 1) {
        advice.push("Khích lệ con qua những 'chiến thắng nhỏ' hằng ngày để con dần tin vào khả năng của bản thân.");
    }
    if (byKey["intrinsic_value"].tier <= 1) {
        advice.push("Kết nối môn Toán với sở thích và đời sống thực tế để con cảm nhận được ý nghĩa của việc học.");
    }
    if (byKey["cognitive_strategy"].tier <= 1) {
        advice.push("Đồng hành cùng con khi học ở nhà: hướng dẫn con cách tóm tắt bài, lập sơ đồ và ghi lại lỗi sai.");
    }
    if (byKey["self_regulation"].tier <= 1) {
        advice.push("Cùng con lập thời gian biểu và mục tiêu nhỏ mỗi ngày, theo dõi nhẹ nhàng để con hình thành thói quen tự học.");
    }
    if (advice.length === 0) {
        advice.push("Tiếp tục đồng hành, ghi nhận và khích lệ để con duy trì phong độ học tập tích cực hiện tại.");
    }
    return advice;
}

function _thucTrangRows(results: GroupResult[]): string {
    return results.map(r => {
        const diemHs = `\\textbf{${r.total} / ${r.max}}\\quad{\\small\\color{muted}TB ${r.avg.toFixed(1)}}\\quad\\pill{${r.color}}{${texEscape(r.level)}}`;
        return `${texEscape(r.name)} & ${r.max} & ${diemHs} \\\\ \\hline`;
    }).join("\n");
}

function _bulletList(items: string[], inTable: boolean = false): string {
    const out = [];
    if (inTable) out.push("\\vspace{-12pt}");
    out.push("\\begin{itemize}");
    for (const it of items) {
        out.push("  \\item " + texEscape(it));
    }
    out.push("\\end{itemize}");
    if (inTable) out.push("\\vspace{-12pt}");
    return out.join("\n");
}

function _loTrinhRows(roadmap: [string, string][]): string {
    return roadmap.map(([name, content]) => {
        return `\\textbf{${texEscape(name)}} & ${texEscape(content)} \\\\ \\hline`;
    }).join("\n");
}

export function buildReportPayload(studentInfo: {name?: string, dob?: string}, results: GroupResult[]): Record<string, string> {
    return {
        "__STUDENT_NAME__": texEscape(studentInfo.name || ""),
        "__STUDENT_DOB__": texEscape(studentInfo.dob || ""),
        "__THUC_TRANG_ROWS__": _thucTrangRows(results),
        "__DIEM_TOT__": _bulletList(buildStrengths(results), true),
        "__DIEM_CAI_THIEN__": _bulletList(buildImprovements(results), true),
        "__NHAN_XET_CHUNG__": texEscape(buildOverallComment(results)),
        "__LO_TRINH_ROWS__": _loTrinhRows(buildRoadmap(results)),
        "__KHUYEN_NGHI_PH__": _bulletList(buildParentAdvice(results), false),
    };
}
