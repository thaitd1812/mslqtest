/**
 * Nội dung 44 câu MSLQ, đúng thứ tự trên phiếu giấy và trong tập câu hỏi
 * ("BÀI TRẮC NGHIỆM ĐÁNH GIÁ ĐỘNG LỰC VÀ PHƯƠNG PHÁP HỌC TẬP.pdf").
 *
 * Đã sửa 2 lỗi đánh máy của bản PDF: câu 3 ("sau này") và câu 29 ("hôm nay").
 * Thứ tự câu phải giữ nguyên — groups.ts chấm theo số thứ tự.
 */
export const QUESTIONS: string[] = [
    'So với các bạn khác trong lớp, con nghĩ mình học môn Toán khá tốt.',
    'Con thấy những gì mình được học trong môn Toán rất thú vị.',
    'Con nghĩ những kiến thức trong môn học Toán rất có ích cho cuộc sống sau này của con.',
    'Việc học hiểu rõ bản chất môn học Toán rất quan trọng đối với con.',
    'Con thích những bài tập khó của môn Toán vì chúng giúp con học được điều mới.',
    'Con tin là mình sẽ hiểu được những kiến thức được dạy trong môn học Toán.',
    'Con nghĩ mình biết cách học môn Toán hiệu quả hơn các bạn khác trong lớp.',
    'Thường thì con tự muốn học môn Toán hơn là bị bố mẹ hay thầy cô ép buộc.',
    'Con tin là mình có thể đạt điểm tốt trong môn học Toán.',
    'Con thích cách suy nghĩ và giải quyết vấn đề của môn học Toán.',
    'Khi làm bài tập về nhà môn Toán, con cố gắng tự làm một mình mà không cần ai giúp.',
    'Con tin là mình có thể làm tốt các bài tập về nhà của môn Toán.',
    'Con thấy những tài liệu, sách đọc thêm của môn Toán rất hay.',
    'Con nghĩ việc học tốt môn Toán sẽ giúp con học tốt các môn học khác.',
    'Con biết mình hoàn toàn có thể học tốt môn Toán nếu cố gắng.',
    'Kể cả khi bài tập không bị chấm điểm, con vẫn muốn làm để hiểu bài hơn.',
    'Ngay cả khi bài học rất khó, con vẫn tin là mình sẽ hiểu được nếu không bỏ cuộc.',
    'Con tin rằng mình có thể giải quyết được những bài tập khó nhất mà thầy cô giao.',
    'Khi làm bài thi, con hay nghĩ về việc mình sẽ bị điểm kém và bị mắng.',
    'Con hay bị lo lắng và bồn chồn mỗi khi có bài kiểm tra hoặc bài thi.',
    'Lúc làm bài kiểm tra, con thấy tim mình đập nhanh hoặc run tay.',
    'Nhiều khi con học bài rất kỹ ở nhà, nhưng vào phòng thi lo quá nên lại quên hết.',
    'Khi học bài, con thường đọc đi đọc lại các ghi chép hoặc sách giáo khoa để nhớ.',
    'Khi nghe giảng, con cố gắng liên hệ những gì thầy cô nói với những điều con đã biết trước đó.',
    'Con thường tự vẽ sơ đồ, kẻ bảng hoặc gạch đầu dòng các ý chính để bài học dễ nhìn hơn.',
    'Con luôn cố gắng hoàn thành bài tập về nhà đúng hạn chứ không để nước đến chân mới nhảy.',
    'Con thường tự đặt câu hỏi cho mình để kiểm tra xem mình đã thực sự hiểu bài chưa.',
    'Khi học bài, con thường tự tóm tắt hoặc viết lại bài học theo cách hiểu của riêng con.',
    'Trước khi bắt đầu học, con thường tự đặt mục tiêu hôm nay mình sẽ hoàn thành những việc gì.',
    'Khi làm bài tập khó, con cố gắng nhớ lại xem thầy cô đã giải các dạng bài tương tự trên lớp như thế nào.',
    'Con thường tự nghĩ ra các ví dụ thực tế để hiểu rõ hơn các định nghĩa hoặc công thức.',
    'Khi đọc sách hoặc tài liệu mà gặp chỗ không hiểu, con sẽ dừng lại đọc kỹ lại từ đầu hoặc đi hỏi chứ không bỏ qua.',
    'Khi ôn thi, con thường xem lại tất cả các bài tập cũ đã làm trong vở.',
    'Con biết cách chọn ra những phần kiến thức quan trọng nhất để tập trung ôn tập trước.',
    'Con thường nhẩm đi nhẩm lại các từ khóa hoặc quy tắc quan trọng để không bị quên.',
    'Trong lúc học, nếu thấy mình bắt đầu mất tập trung hoặc nghĩ chuyện khác, con sẽ chủ động kéo mình quay lại bài học.',
    'Con cố gắng tìm mối liên hệ giữa các phần khác nhau của môn học Toán để thấy bức tranh toàn cảnh.',
    'Khi đọc sách, con luôn chú ý đến các tiêu đề lớn và phần tóm tắt cuối chương trước.',
    'Con thích tự tìm thêm các cách giải khác cho cùng một bài toán/vấn đề.',
    'Con thường ghi lại những lỗi sai mình từng mắc phải để lần sau không lặp lại nữa.',
    'Kể cả khi bài tập rất chán hoặc rất khó, con vẫn cố gắng ép mình ngồi làm cho xong chứ không bỏ dở.',
    'Con thường tính toán trước thời gian cần thiết để hoàn thành một bài tập hoặc ôn tập cho một bài kiểm tra.',
    'Nếu phương pháp học hiện tại không hiệu quả (làm bài vẫn sai), con sẽ chủ động tìm cách học khác thay thế.',
    'Con biết cách tự sắp xếp góc học tập của mình yên tĩnh để không bị tivi, điện thoại làm xao nhãng.',
];

/** Thang 5 mức, cùng nhãn với phiếu giấy. */
export const SCALE: { value: number; label: string; hint: string }[] = [
    { value: 1, label: 'Hoàn toàn không đúng', hint: 'Gần như chưa bao giờ' },
    { value: 2, label: 'Không đúng', hint: 'Thỉnh thoảng mới có' },
    { value: 3, label: 'Đúng một phần', hint: 'Lúc đúng, lúc không' },
    { value: 4, label: 'Đúng', hint: 'Phần lớn thời gian' },
    { value: 5, label: 'Hoàn toàn đúng', hint: 'Gần như lúc nào cũng vậy' },
];
