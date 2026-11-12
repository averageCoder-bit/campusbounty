from app.grading import LESSONS, get_lesson, grade_attempt, level_from_xp, prerequisites


def answer_key(item):
    if q(item["id"])["kind"] in ("choice", "trace"):
        return item["order"].index(q(item["id"])["answerIndex"])
    if q(item["id"])["kind"] == "sequence":
        return [item["order"].index(i) for i in range(3)]
    if q(item["id"])["kind"] == "fill":
        return q(item["id"])["accepted"][0]
    raise AssertionError()


def q(qid):
    return next(q for l in LESSONS.values() for q in l["assessment"] if q["id"] == qid)


def test_all_12_lessons_and_every_valid_answer():
    assert len(LESSONS) == 12
    for lesson in LESSONS.values():
        private = []
        for item in lesson["assessment"]:
            order = [2, 0, 1] if item["kind"] != "fill" else []
            private.append({"id": item["id"], "order": order})
        answers = [answer_key(item) for item in private]
        result = grade_attempt(lesson, private, answers)
        assert result["passed"] and result["score"] == len(private)
        result = grade_attempt(lesson, private, [None] * len(private))
        assert result["score"] == 0 and not result["passed"]


def test_prerequisites_and_levels():
    assert prerequisites("cs-01-bits") == []
    assert prerequisites("cs-06-capstone") == [
        "cs-01-bits", "cs-02-io", "cs-03-algorithms", "cs-04-variables", "cs-05-debugging"
    ]
    assert level_from_xp(0) == {"level": 1, "xp": 0, "xpToNext": 100}
    assert level_from_xp(100) == {"level": 2, "xp": 0, "xpToNext": 150}
    assert level_from_xp(450) == {"level": 4, "xp": 0, "xpToNext": 250}


def test_reject_malformed_responses():
    lesson = get_lesson("cs-01-bits")
    private = [{"id": i["id"], "order": [0, 1, 2] if i["kind"] != "fill" else []}
               for i in lesson["assessment"]]
    assert grade_attempt(lesson, private, [True, 0, "9"])["score"] < len(private)
    try:
        grade_attempt(lesson, private, [0])
        assert False, "Wrong number of answers accepted"
    except ValueError:
        pass
