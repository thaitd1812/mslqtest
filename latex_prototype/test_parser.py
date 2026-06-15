# -*- coding: utf-8 -*-
"""
Engine chấm điểm MSLQ (44 câu / 5 nhóm) + sinh báo cáo PDF (LaTeX/xelatex).

Nguồn chuẩn:
  - 44 câu hỏi gốc:  BÀI TRẮC NGHIỆM ĐÁNH GIÁ ĐỘNG LỰC VÀ PHƯƠNG PHÁP HỌC TẬP.pdf
  - Thang chấm điểm: THANG ĐÁNH GIÁ ĐỘNG LỰC VÀ CHIẾN LƯỢC HỌC TẬP.pdf
  - Mẫu báo cáo:     MẪU BÁO CÁO.docx.pdf

Cách chấm: mỗi nhóm tính ĐIỂM TRUNG BÌNH = tổng điểm / số câu (thang 1.0 - 5.0),
phân loại theo 4 mức. Riêng nhóm "Lo âu khi kiểm tra" đảo chiều (điểm cao = xấu).
"""

import subprocess

# ---------------------------------------------------------------------------
# 1. NGÂN HÀNG 44 CÂU HỎI GỐC (trích nguyên văn từ bài trắc nghiệm chuẩn)
# ---------------------------------------------------------------------------
MSLQ_QUESTIONS = [
    "So với các bạn khác trong lớp, con nghĩ mình học môn Toán khá tốt.",                                                 # 1
    "Con thấy những gì mình được học trong môn Toán rất thú vị.",                                                          # 2
    "Con nghĩ những kiến thức trong môn học Toán rất có ích cho cuộc sống sau này của con.",                               # 3
    "Việc học hiểu rõ bản chất môn học Toán rất quan trọng đối với con.",                                                  # 4
    "Con thích những bài tập khó của môn Toán vì chúng giúp con học được điều mới.",                                       # 5
    "Con tin là mình sẽ hiểu được những kiến thức được dạy trong môn học Toán.",                                          # 6
    "Con nghĩ mình biết cách học môn Toán hiệu quả hơn các bạn khác trong lớp.",                                          # 7
    "Thường thì con tự muốn học môn Toán hơn là bị bố mẹ hay thầy cô ép buộc.",                                          # 8
    "Con tin là mình có thể đạt điểm tốt trong môn học Toán.",                                                            # 9
    "Con thích cách suy nghĩ và giải quyết vấn đề của môn học Toán.",                                                     # 10
    "Khi làm bài tập về nhà môn Toán, con cố gắng tự làm một mình mà không cần ai giúp.",                                # 11
    "Con tin là mình có thể làm tốt các bài tập về nhà của môn Toán.",                                                    # 12
    "Con thấy những tài liệu, sách đọc thêm của môn Toán rất hay.",                                                       # 13
    "Con nghĩ việc học tốt môn Toán sẽ giúp con học tốt các môn học khác.",                                              # 14
    "Con biết mình hoàn toàn có thể học tốt môn Toán nếu cố gắng.",                                                       # 15
    "Kể cả khi bài tập không bị chấm điểm, con vẫn muốn làm để hiểu bài hơn.",                                           # 16
    "Ngay cả khi bài học rất khó, con vẫn tin là mình sẽ hiểu được nếu không bỏ cuộc.",                                 # 17
    "Con tin rằng mình có thể giải quyết được những bài tập khó nhất mà thầy cô giao.",                                  # 18
    "Khi làm bài thi, con hay nghĩ về việc mình sẽ bị điểm kém và bị mắng.",                                            # 19
    "Con hay bị lo lắng và bồn chồn mỗi khi có bài kiểm tra hoặc bài thi.",                                              # 20
    "Lúc làm bài kiểm tra, con thấy tim mình đập nhanh hoặc run tay.",                                                   # 21
    "Nhiều khi con học bài rất kỹ ở nhà, nhưng vào phòng thi lo quá nên lại quên hết.",                                 # 22
    "Khi học bài, con thường đọc đi đọc lại các ghi chép hoặc sách giáo khoa để nhớ.",                                  # 23
    "Khi nghe giảng, con cố gắng liên hệ những gì thầy cô nói với những điều con đã biết trước đó.",                    # 24
    "Con thường tự vẽ sơ đồ, kẻ bảng hoặc gạch đầu dòng các ý chính để bài học dễ nhìn hơn.",                          # 25
    "Con luôn cố gắng hoàn thành bài tập về nhà đúng hạn chứ không để nước đến chân mới nhảy.",                         # 26
    "Con thường tự đặt câu hỏi cho mình để kiểm tra xem mình đã thực sự hiểu bài chưa.",                                # 27
    "Khi học bài, con thường tự tóm tắt hoặc viết lại bài học theo cách hiểu của riêng con.",                          # 28
    "Trước khi bắt đầu học, con thường tự đặt mục tiêu hôm nay mình sẽ hoàn thành những việc gì.",                     # 29
    "Khi làm bài tập khó, con cố gắng nhớ lại xem thầy cô đã giải các dạng bài tương tự trên lớp như thế nào.",        # 30
    "Con thường tự nghĩ ra các ví dụ thực tế để hiểu rõ hơn các định nghĩa hoặc công thức.",                           # 31
    "Khi đọc sách hoặc tài liệu mà gặp chỗ không hiểu, con sẽ dừng lại đọc kỹ lại từ đầu hoặc đi hỏi chứ không bỏ qua.",# 32
    "Khi ôn thi, con thường xem lại tất cả các bài tập cũ đã làm trong vở.",                                            # 33
    "Con biết cách chọn ra những phần kiến thức quan trọng nhất để tập trung ôn tập trước.",                           # 34
    "Con thường nhẩm đi nhẩm lại các từ khóa hoặc quy tắc quan trọng để không bị quên.",                               # 35
    "Trong lúc học, nếu thấy mình bắt đầu mất tập trung hoặc nghĩ chuyện khác, con sẽ chủ động kéo mình quay lại bài học.",# 36
    "Con cố gắng tìm mối liên hệ giữa các phần khác nhau của môn học Toán để thấy bức tranh toàn cảnh.",               # 37
    "Khi đọc sách, con luôn chú ý đến các tiêu đề lớn và phần tóm tắt cuối chương trước.",                             # 38
    "Con thích tự tìm thêm các cách giải khác cho cùng một bài toán/vấn đề.",                                          # 39
    "Con thường ghi lại những lỗi sai mình từng mắc phải để lần sau không lặp lại nữa.",                               # 40
    "Kể cả khi bài tập rất chán hoặc rất khó, con vẫn cố gắng ép mình ngồi làm cho xong chứ không bỏ dở.",            # 41
    "Con thường tính toán trước thời gian cần thiết để hoàn thành một bài tập hoặc ôn tập cho một bài kiểm tra.",      # 42
    "Nếu phương pháp học hiện tại không hiệu quả (làm bài vẫn sai), con sẽ chủ động tìm cách học khác thay thế.",      # 43
    "Con biết cách tự sắp xếp góc học tập của mình yên tĩnh để không bị tivi, điện thoại làm xao nhãng.",              # 44
]

# ---------------------------------------------------------------------------
# 2. ĐỊNH NGHĨA 5 NHÓM + THANG ĐÁNH GIÁ (đúng theo file THANG ĐÁNH GIÁ)
#    `questions` dùng SỐ CÂU 1-indexed cho khớp tài liệu gốc.
# ---------------------------------------------------------------------------
# Mức điểm trung bình -> tier 0..3
#   tier 0: 1.0 - 2.0   tier 1: 2.1 - 3.0   tier 2: 3.1 - 4.0   tier 3: 4.1 - 5.0
BAND_RANGES = ["1.0 - 2.0", "2.1 - 3.0", "3.1 - 4.0", "4.1 - 5.0"]

# Diễn giải cho 4 nhóm "thuận" (điểm cao = tốt). tier 0..3
LEVELS_POSITIVE = ["Cần ưu tiên cải thiện", "Cần hỗ trợ", "Khá", "Tốt"]
# Nhóm Lo âu "đảo chiều" (điểm cao = xấu). tier 0..3
LEVELS_ANXIETY = ["Áp lực thấp", "Áp lực trung bình", "Áp lực cao", "Áp lực rất cao"]

GROUPS = [
    {
        "key": "self_efficacy",
        "name": "Niềm tin vào năng lực học tập",
        "en": "Self-Efficacy",
        "questions": [1, 6, 7, 9, 11, 12, 15, 17, 18],
        "max": 45,
        "reversed": False,
        # diễn giải theo tier 0..3
        "desc": [
            "Con thiếu tự tin rõ, dễ nghĩ mình không học tốt hoặc không làm được bài khó.",
            "Con chưa thật sự tin vào năng lực của mình, dễ nghi ngờ bản thân khi học chưa tốt.",
            "Con có niềm tin tương đối tốt, nhưng đôi lúc vẫn cần được khích lệ khi gặp bài khó.",
            "Con tự tin vào khả năng học, tin mình có thể hiểu bài và làm được bài khó.",
        ],
    },
    {
        "key": "intrinsic_value",
        "name": "Giá trị và hứng thú học tập",
        "en": "Intrinsic Value",
        "questions": [2, 3, 4, 5, 8, 10, 13, 14, 16],
        "max": 45,
        "reversed": False,
        "desc": [
            "Con ít hứng thú, có thể học vì bị ép hoặc chưa thấy ý nghĩa của môn học.",
            "Con chưa thật sự thấy môn học hấp dẫn hoặc chưa rõ học để làm gì.",
            "Con nhìn thấy giá trị của môn học, nhưng hứng thú có thể chưa ổn định.",
            "Con thấy môn học thú vị, có ích và có động lực học từ bên trong.",
        ],
    },
    {
        "key": "test_anxiety",
        "name": "Lo âu khi kiểm tra",
        "en": "Test Anxiety",
        "questions": [19, 20, 21, 22],
        "max": 20,
        "reversed": True,
        "desc": [
            "Con khá thoải mái khi làm bài kiểm tra, ít bị căng thẳng bởi điểm số.",
            "Con có lo lắng khi kiểm tra nhưng chưa ảnh hưởng quá nhiều đến kết quả.",
            "Con dễ căng thẳng, lo sợ điểm kém hoặc sợ bị mắng khi làm bài kiểm tra.",
            "Con có biểu hiện lo âu rõ khi kiểm tra, cần phụ huynh và giáo viên hỗ trợ giảm áp lực.",
        ],
    },
    {
        "key": "cognitive_strategy",
        "name": "Chiến lược học tập",
        "en": "Cognitive Strategy",
        "questions": [23, 24, 25, 28, 30, 31, 33, 34, 35, 37, 38, 39, 40],
        "max": 65,
        "reversed": False,
        "desc": [
            "Con chưa biết cách học hiệu quả, dễ học đối phó hoặc học thuộc mà chưa hiểu bản chất.",
            "Con còn học theo thói quen đơn giản, chưa có nhiều chiến lược để hiểu sâu và ghi nhớ lâu.",
            "Con đã có một số cách học hiệu quả, nhưng cần duy trì đều và biết chọn phương pháp phù hợp hơn.",
            "Con biết sử dụng nhiều phương pháp học như tóm tắt, liên hệ kiến thức, ghi lỗi sai, tìm cách giải khác.",
        ],
    },
    {
        "key": "self_regulation",
        "name": "Khả năng tự điều chỉnh việc học",
        "en": "Self-Regulation",
        "questions": [26, 27, 29, 32, 36, 41, 42, 43, 44],
        "max": 45,
        "reversed": False,
        "desc": [
            "Con phụ thuộc nhiều vào người lớn, khó tự bắt đầu và duy trì việc học.",
            "Con chưa ổn định trong việc tự học, dễ trì hoãn hoặc mất tập trung.",
            "Con có ý thức tự học, nhưng vẫn cần thêm sự nhắc nhở hoặc hướng dẫn để duy trì đều.",
            "Con có khả năng tự quản lý việc học tốt, biết đặt mục tiêu, giữ tập trung và duy trì nỗ lực.",
        ],
    },
]

# Màu nhãn mức (khớp \definecolor trong template)
TIER_COLOR_POSITIVE = ["lvlbad", "lvlwarn", "lvlok", "lvlgood"]   # tier 0..3
TIER_COLOR_ANXIETY = ["lvlgood", "lvlok", "lvlwarn", "lvlbad"]    # tier 0..3 (đảo chiều)


# ---------------------------------------------------------------------------
# 3. HÀM TIỆN ÍCH
# ---------------------------------------------------------------------------
def _tier_from_avg(avg):
    """Quy điểm trung bình (1.0-5.0) về tier 0..3 theo thang chuẩn."""
    if avg <= 2.0:
        return 0
    if avg <= 3.0:
        return 1
    if avg <= 4.0:
        return 2
    return 3


def tex_escape(s):
    """Escape các ký tự đặc biệt LaTeX trong văn bản tự do."""
    repl = {
        "\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$",
        "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}",
        "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
    }
    return "".join(repl.get(c, c) for c in s)


# ---------------------------------------------------------------------------
# 4. CHẤM ĐIỂM
# ---------------------------------------------------------------------------
def grade(student_answers):
    """Nhận 44 đáp án (list điểm 1-5, index 0 = câu 1). Trả về kết quả từng nhóm."""
    if len(student_answers) != 44:
        raise ValueError("Bài test phải có đúng 44 câu trả lời")
    if any(a not in (1, 2, 3, 4, 5) for a in student_answers):
        raise ValueError("Mỗi đáp án phải nằm trong khoảng 1-5")

    results = []
    for g in GROUPS:
        total = sum(student_answers[q - 1] for q in g["questions"])
        count = len(g["questions"])
        avg = total / count
        tier = _tier_from_avg(avg)
        if g["reversed"]:
            level = LEVELS_ANXIETY[tier]
            color = TIER_COLOR_ANXIETY[tier]
        else:
            level = LEVELS_POSITIVE[tier]
            color = TIER_COLOR_POSITIVE[tier]
        results.append({
            "key": g["key"], "name": g["name"], "reversed": g["reversed"],
            "total": total, "max": g["max"], "count": count,
            "avg": avg, "tier": tier, "level": level, "color": color,
            "desc": g["desc"][tier], "range": BAND_RANGES[tier],
        })
    return results


# ---------------------------------------------------------------------------
# 5. SINH NỘI DUNG BÁO CÁO (rule-based)
#    Mỗi đoạn "mềm" là 1 hàm riêng -> sau này dễ thay bằng Gemini.
# ---------------------------------------------------------------------------
def build_strengths(results):
    """II - 'Điểm tốt': nhóm thuận >= 4.1 (Tốt) + nhóm Lo âu nếu áp lực thấp."""
    items = []
    for r in results:
        if not r["reversed"] and r["tier"] == 3:
            items.append(f"{r['name']}: {r['desc']}")
        if r["reversed"] and r["tier"] == 0:
            items.append(f"Tâm lý phòng thi vững vàng - {r['desc']}")
    if not items:
        # không có nhóm nào đạt 'Tốt' -> nêu nhóm cao điểm nhất (trừ lo âu)
        best = max((r for r in results if not r["reversed"]), key=lambda r: r["avg"])
        items.append(f"Điểm sáng tương đối: {best['name']} (trung bình {best['avg']:.1f} - {best['level']}).")
    return items


def build_improvements(results):
    """II - 'Điểm cần cải thiện': nhóm thuận <= 3.0 + Lo âu >= 3.1 (cảnh báo)."""
    items = []
    for r in results:
        if not r["reversed"] and r["tier"] in (0, 1):
            tag = "ƯU TIÊN trong 4 tuần đầu" if r["tier"] == 0 else "cần hỗ trợ"
            items.append(f"{r['name']} ({tag}): {r['desc']}")
        if r["reversed"] and r["tier"] >= 2:
            items.append(f"Lo âu khi kiểm tra ({r['level']} - cần lưu ý với phụ huynh và giáo viên): {r['desc']}")
    if not items:
        items.append("Chưa có nhóm nào ở mức báo động. Con đang phát triển khá cân bằng, tiếp tục duy trì và nâng dần các nhóm ở mức Khá lên Tốt.")
    return items


def build_overall_comment(results):
    """II - 'Nhận xét chung': tổng hợp bức tranh năng lực học tập."""
    by_key = {r["key"]: r for r in results}
    strong = [r["name"] for r in results if not r["reversed"] and r["tier"] == 3]
    weak = [r["name"] for r in results if not r["reversed"] and r["tier"] in (0, 1)]
    anxiety = by_key["test_anxiety"]

    parts = []
    if strong:
        parts.append("Con có nền tảng tốt ở nhóm " + ", ".join(strong).lower() + ".")
    if weak:
        parts.append("Nhóm cần được quan tâm nhiều hơn là " + ", ".join(weak).lower() + ".")
    if not strong and not weak:
        parts.append("Các chỉ số của con khá đồng đều, phần lớn ở mức Khá.")

    if anxiety["tier"] >= 2:
        parts.append(
            "Đặc biệt, mức lo âu khi kiểm tra đang ở ngưỡng "
            + anxiety["level"].lower()
            + " - đây là yếu tố tâm lý cần được ưu tiên tháo gỡ vì có thể khiến con làm bài dưới khả năng thực tế."
        )
    elif anxiety["tier"] == 1:
        parts.append("Mức lo âu khi kiểm tra ở ngưỡng trung bình, nằm trong tầm kiểm soát.")
    else:
        parts.append("Con giữ được tâm lý khá thoải mái khi làm bài kiểm tra.")

    return " ".join(parts)


def build_roadmap(results):
    """III.1 - Lộ trình 3 giai đoạn, cá nhân hóa theo nhóm yếu."""
    by_key = {r["key"]: r for r in results}
    priority = [r for r in results if not r["reversed"] and r["tier"] == 0]   # 1.0-2.0
    support = [r for r in results if not r["reversed"] and r["tier"] == 1]    # 2.1-3.0
    okay = [r for r in results if not r["reversed"] and r["tier"] == 2]       # 3.1-4.0 (Khá)
    anxiety = by_key["test_anxiety"]

    def names(lst):
        return ", ".join(r["name"].lower() for r in lst)

    # --- Giai đoạn 1 (Tuần 1-4): ổn định tâm lý + lấp lỗ hổng ưu tiên ---
    gd1 = []
    if anxiety["tier"] >= 2:
        gd1.append("Ổn định tâm lý phòng thi: cho con làm các bài kiểm tra ngắn, áp lực thấp, tăng dần độ khó để con quen với cảm giác thi cử và bớt căng thẳng.")
    if priority:
        gd1.append("Củng cố cấp thiết nhóm " + names(priority) + " bằng các nhiệm vụ nhỏ, dễ đạt để con tạo lại 'chiến thắng nhỏ' và lấy lại niềm tin.")
    if not gd1:
        target = support[0] if support else min((r for r in results if not r["reversed"]), key=lambda r: r["avg"])
        gd1.append("Rà soát và củng cố nền tảng ở nhóm " + target["name"].lower() + ", thiết lập thói quen học đều mỗi ngày.")
    gd1_text = "Mục tiêu: " + " ".join(gd1)

    # --- Giai đoạn 2 (Tuần 5-8): xây phương pháp & chiến lược ---
    gd2_targets = support if support else okay
    if gd2_targets:
        gd2_text = (
            "Mục tiêu: Trang bị phương pháp học hiệu quả cho nhóm " + names(gd2_targets)
            + ". Hướng dẫn con kỹ năng tóm tắt bài, vẽ sơ đồ, ghi chú lỗi sai và tự đặt câu hỏi kiểm tra mức độ hiểu."
        )
    else:
        gd2_text = "Mục tiêu: Duy trì phương pháp học tốt hiện có, bổ sung các kỹ thuật ghi nhớ và liên hệ kiến thức nâng cao."

    # --- Giai đoạn 3 (Tuần 9-12): tự điều chỉnh & duy trì ---
    gd3_text = (
        "Mục tiêu: Rèn cho con khả năng tự lập kế hoạch, tự đặt mục tiêu và tự đánh giá tiến độ học. "
        "Nâng dần các nhóm đang ở mức Khá lên mức Tốt và duy trì thói quen học tập bền vững."
    )

    return [
        ("Giai đoạn 1 (Tuần 1-4)", gd1_text),
        ("Giai đoạn 2 (Tuần 5-8)", gd2_text),
        ("Giai đoạn 3 (Tuần 9-12)", gd3_text),
    ]


def build_parent_advice(results):
    """III.2 - Khuyến nghị cho phụ huynh."""
    by_key = {r["key"]: r for r in results}
    advice = []
    if by_key["test_anxiety"]["tier"] >= 2:
        advice.append("Tránh tạo thêm áp lực điểm số; ghi nhận và động viên nỗ lực của con thay vì chỉ nhìn vào kết quả bài thi.")
    if by_key["self_efficacy"]["tier"] <= 1:
        advice.append("Khích lệ con qua những 'chiến thắng nhỏ' hằng ngày để con dần tin vào khả năng của bản thân.")
    if by_key["intrinsic_value"]["tier"] <= 1:
        advice.append("Kết nối môn Toán với sở thích và đời sống thực tế để con cảm nhận được ý nghĩa của việc học.")
    if by_key["cognitive_strategy"]["tier"] <= 1:
        advice.append("Đồng hành cùng con khi học ở nhà: hướng dẫn con cách tóm tắt bài, lập sơ đồ và ghi lại lỗi sai.")
    if by_key["self_regulation"]["tier"] <= 1:
        advice.append("Cùng con lập thời gian biểu và mục tiêu nhỏ mỗi ngày, theo dõi nhẹ nhàng để con hình thành thói quen tự học.")
    if not advice:
        advice.append("Tiếp tục đồng hành, ghi nhận và khích lệ để con duy trì phong độ học tập tích cực hiện tại.")
    return advice


# ---------------------------------------------------------------------------
# 6. KẾT XUẤT LATEX
# ---------------------------------------------------------------------------
def _thuc_trang_rows(results):
    rows = []
    for r in results:
        diem_hs = (
            f"\\textbf{{{r['total']} / {r['max']}}}\\quad{{\\small\\color{{muted}}TB {r['avg']:.1f}}}"
            f"\\quad\\pill{{{r['color']}}}{{{tex_escape(r['level'])}}}"
        )
        rows.append(f"{tex_escape(r['name'])} & {r['max']} & {diem_hs} \\\\ \\hline")
    return "\n".join(rows)


def _bullet_list(items):
    out = [r"\begin{itemize}"]
    for it in items:
        out.append(r"  \item " + tex_escape(it))
    out.append(r"\end{itemize}")
    return "\n".join(out)


def _lo_trinh_rows(roadmap):
    rows = []
    for name, content in roadmap:
        rows.append(
            f"\\textbf{{{tex_escape(name)}}} & {tex_escape(content)} \\\\ \\hline"
        )
    return "\n".join(rows)


def build_report_payload(student_info, results):
    return {
        "__STUDENT_NAME__": tex_escape(student_info.get("name", "")),
        "__STUDENT_DOB__": tex_escape(student_info.get("dob", "")),
        "__THUC_TRANG_ROWS__": _thuc_trang_rows(results),
        "__DIEM_TOT__": _bullet_list(build_strengths(results)),
        "__DIEM_CAI_THIEN__": _bullet_list(build_improvements(results)),
        "__NHAN_XET_CHUNG__": tex_escape(build_overall_comment(results)),
        "__LO_TRINH_ROWS__": _lo_trinh_rows(build_roadmap(results)),
        "__KHUYEN_NGHI_PH__": _bullet_list(build_parent_advice(results)),
    }


def generate_pdf_report(student_info, results, template_path="motivation_template.tex",
                        output_name="motivation_report.tex"):
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    for key, value in build_report_payload(student_info, results).items():
        template = template.replace(key, value)

    with open(output_name, "w", encoding="utf-8") as f:
        f.write(template)
    print(">> Đã tạo file TEX:", output_name)

    print(">> Đang gọi xelatex để sinh PDF...")
    for _ in range(2):  # chạy 2 lần cho ổn định longtable/header
        subprocess.run(["xelatex", "-interaction=nonstopmode", output_name], check=True)
    print(">> HOÀN TẤT! File PDF:", output_name.replace(".tex", ".pdf"))


# ---------------------------------------------------------------------------
# 7. DEMO
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    student_info = {
        "name": "Nguyễn Hoàng Mai",
        "dob": "2012",
    }

    # Mock 1 bài làm (key = số câu 1-44, value = điểm 1-5) tạo hồ sơ đa dạng:
    #   Niềm tin: Khá | Giá trị: Cần hỗ trợ | Lo âu: cao | Chiến lược: Tốt | Tự điều chỉnh: Khá
    mock = {
        1: 4, 6: 4, 7: 3, 9: 4, 11: 3, 12: 4, 15: 4, 17: 3, 18: 4,          # Self-Efficacy
        2: 3, 3: 3, 4: 2, 5: 2, 8: 3, 10: 3, 13: 2, 14: 3, 16: 3,           # Intrinsic Value
        19: 4, 20: 4, 21: 3, 22: 4,                                          # Test Anxiety
        23: 4, 24: 4, 25: 5, 28: 4, 30: 4, 31: 4, 33: 5, 34: 4,
        35: 4, 37: 4, 38: 4, 39: 5, 40: 4,                                   # Cognitive Strategy
        26: 3, 27: 3, 29: 4, 32: 3, 36: 3, 41: 3, 42: 3, 43: 4, 44: 3,      # Self-Regulation
    }
    answers = [mock[i] for i in range(1, 45)]

    results = grade(answers)

    print("\n=== KẾT QUẢ CHẤM ===")
    for r in results:
        print(f"- {r['name']:<35} {r['total']:>2}/{r['max']:<2}  TB {r['avg']:.2f}  -> {r['level']}")

    generate_pdf_report(student_info, results)
