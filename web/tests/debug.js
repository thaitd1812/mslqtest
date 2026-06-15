const { grade, buildReportPayload } = require('../lib/mslq/score');
const mock = {
    1: 4, 6: 4, 7: 3, 9: 4, 11: 3, 12: 4, 15: 4, 17: 3, 18: 4,          
    2: 3, 3: 3, 4: 2, 5: 2, 8: 3, 10: 3, 13: 2, 14: 3, 16: 3,           
    19: 4, 20: 4, 21: 3, 22: 4,                                          
    23: 4, 24: 4, 25: 5, 28: 4, 30: 4, 31: 4, 33: 5, 34: 4,
    35: 4, 37: 4, 38: 4, 39: 5, 40: 4,                                   
    26: 3, 27: 3, 29: 4, 32: 3, 36: 3, 41: 3, 42: 3, 43: 4, 44: 3,      
};
const answers = [];
for (let i = 1; i <= 44; i++) answers.push(mock[i]);
const results = grade(answers);
const payload = buildReportPayload({name: "Nguyễn Hoàng Mai", dob: "2012"}, results);
console.log(payload["__NHAN_XET_CHUNG__"]);
