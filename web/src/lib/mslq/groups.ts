export type MSLQGroupKey = 'self_efficacy' | 'intrinsic_value' | 'test_anxiety' | 'cognitive_strategy' | 'self_regulation';

export interface MSLQGroup {
  key: MSLQGroupKey;
  name: string;
  en: string;
  questions: number[]; // 1-indexed
  max: number;
  reversed: boolean;
  desc: string[];
}

export const GROUPS: MSLQGroup[] = [
  {
      key: "self_efficacy",
      name: "Niềm tin vào năng lực học tập",
      en: "Self-Efficacy",
      questions: [1, 6, 7, 9, 11, 12, 15, 17, 18],
      max: 45,
      reversed: false,
      desc: [
          "Con thiếu tự tin rõ, dễ nghĩ mình không học tốt hoặc không làm được bài khó.",
          "Con chưa thật sự tin vào năng lực của mình, dễ nghi ngờ bản thân khi học chưa tốt.",
          "Con có niềm tin tương đối tốt, nhưng đôi lúc vẫn cần được khích lệ khi gặp bài khó.",
          "Con tự tin vào khả năng học, tin mình có thể hiểu bài và làm được bài khó.",
      ],
  },
  {
      key: "intrinsic_value",
      name: "Giá trị và hứng thú học tập",
      en: "Intrinsic Value",
      questions: [2, 3, 4, 5, 8, 10, 13, 14, 16],
      max: 45,
      reversed: false,
      desc: [
          "Con ít hứng thú, có thể học vì bị ép hoặc chưa thấy ý nghĩa của môn học.",
          "Con chưa thật sự thấy môn học hấp dẫn hoặc chưa rõ học để làm gì.",
          "Con nhìn thấy giá trị của môn học, nhưng hứng thú có thể chưa ổn định.",
          "Con thấy môn học thú vị, có ích và có động lực học từ bên trong.",
      ],
  },
  {
      key: "test_anxiety",
      name: "Lo âu khi kiểm tra",
      en: "Test Anxiety",
      questions: [19, 20, 21, 22],
      max: 20,
      reversed: true,
      desc: [
          "Con khá thoải mái khi làm bài kiểm tra, ít bị căng thẳng bởi điểm số.",
          "Con có lo lắng khi kiểm tra nhưng chưa ảnh hưởng quá nhiều đến kết quả.",
          "Con dễ căng thẳng, lo sợ điểm kém hoặc sợ bị mắng khi làm bài kiểm tra.",
          "Con có biểu hiện lo âu rõ khi kiểm tra, cần phụ huynh và giáo viên hỗ trợ giảm áp lực.",
      ],
  },
  {
      key: "cognitive_strategy",
      name: "Chiến lược học tập",
      en: "Cognitive Strategy",
      questions: [23, 24, 25, 28, 30, 31, 33, 34, 35, 37, 38, 39, 40],
      max: 65,
      reversed: false,
      desc: [
          "Con chưa biết cách học hiệu quả, dễ học đối phó hoặc học thuộc mà chưa hiểu bản chất.",
          "Con còn học theo thói quen đơn giản, chưa có nhiều chiến lược để hiểu sâu và ghi nhớ lâu.",
          "Con đã có một số cách học hiệu quả, nhưng cần duy trì đều và biết chọn phương pháp phù hợp hơn.",
          "Con biết sử dụng nhiều phương pháp học như tóm tắt, liên hệ kiến thức, ghi lỗi sai, tìm cách giải khác.",
      ],
  },
  {
      key: "self_regulation",
      name: "Khả năng tự điều chỉnh việc học",
      en: "Self-Regulation",
      questions: [26, 27, 29, 32, 36, 41, 42, 43, 44],
      max: 45,
      reversed: false,
      desc: [
          "Con phụ thuộc nhiều vào người lớn, khó tự bắt đầu và duy trì việc học.",
          "Con chưa ổn định trong việc tự học, dễ trì hoãn hoặc mất tập trung.",
          "Con có ý thức tự học, nhưng vẫn cần thêm sự nhắc nhở hoặc hướng dẫn để duy trì đều.",
          "Con có khả năng tự quản lý việc học tốt, biết đặt mục tiêu, giữ tập trung và duy trì nỗ lực.",
      ],
  },
];

export const BAND_RANGES = ["1.0 - 2.0", "2.1 - 3.0", "3.1 - 4.0", "4.1 - 5.0"];
export const LEVELS_POSITIVE = ["Cần ưu tiên cải thiện", "Cần hỗ trợ", "Khá", "Tốt"];
export const LEVELS_ANXIETY = ["Áp lực thấp", "Áp lực trung bình", "Áp lực cao", "Áp lực rất cao"];

export const TIER_COLOR_POSITIVE = ["lvlbad", "lvlwarn", "lvlok", "lvlgood"];
export const TIER_COLOR_ANXIETY = ["lvlgood", "lvlok", "lvlwarn", "lvlbad"];
