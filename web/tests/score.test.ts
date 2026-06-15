import test from 'node:test';
import assert from 'node:assert';
import { grade, buildReportPayload } from '../src/lib/mslq/score';

test('Golden Test for MSLQ scoring logic', () => {
    const studentInfo = {
        name: "Nguyễn Hoàng Mai",
        dob: "2012",
    };

    const mock: Record<number, number> = {
        1: 4, 6: 4, 7: 3, 9: 4, 11: 3, 12: 4, 15: 4, 17: 3, 18: 4,          // Self-Efficacy
        2: 3, 3: 3, 4: 2, 5: 2, 8: 3, 10: 3, 13: 2, 14: 3, 16: 3,           // Intrinsic Value
        19: 4, 20: 4, 21: 3, 22: 4,                                          // Test Anxiety
        23: 4, 24: 4, 25: 5, 28: 4, 30: 4, 31: 4, 33: 5, 34: 4,
        35: 4, 37: 4, 38: 4, 39: 5, 40: 4,                                   // Cognitive Strategy
        26: 3, 27: 3, 29: 4, 32: 3, 36: 3, 41: 3, 42: 3, 43: 4, 44: 3,      // Self-Regulation
    };

    const answers: number[] = [];
    for (let i = 1; i <= 44; i++) {
        answers.push(mock[i]);
    }

    const results = grade(answers);
    
    // Check lengths and names
    assert.strictEqual(results.length, 5);
    assert.strictEqual(results[0].key, 'self_efficacy');
    assert.strictEqual(results[1].key, 'intrinsic_value');
    
    // Check specific scores
    assert.strictEqual(results[0].total, 33);
    assert.strictEqual(results[0].max, 45);
    assert.strictEqual(Math.round(results[0].avg * 100) / 100, 3.67);
    assert.strictEqual(results[0].level, 'Khá');

    const payload = buildReportPayload(studentInfo, results);
    
    // Check generated payload
    assert.strictEqual(payload["__STUDENT_NAME__"], "Nguyễn Hoàng Mai");
    assert.strictEqual(payload["__STUDENT_DOB__"], "2012");
    assert.ok(payload["__NHAN_XET_CHUNG__"].includes("áp lực cao"));
    assert.ok(payload["__DIEM_CAI_THIEN__"].includes("Giá trị và hứng thú học tập"));
});
