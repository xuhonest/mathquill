suite('text', function() {

  function fromLatex(latex) {
    var block = latexMathParser.parse(latex);
    block.jQize();

    return block;
  }

  function assertSplit(jQ, prev, next) {
    var dom = jQ[0];

    if (prev) {
      assert.ok(dom.previousSibling instanceof Text);
      assert.equal(prev, dom.previousSibling.data);
    }
    else {
      assert.ok(!dom.previousSibling);
    }

    if (next) {
      assert.ok(dom.nextSibling instanceof Text);
      assert.equal(next, dom.nextSibling.data);
    }
    else {
      assert.ok(!dom.nextSibling);
    }
  }

  test('changes the text nodes as the cursor moves around', function() {
    var block = fromLatex('\\text{abc}');
    var ctrlr = Controller(block, 0, 0);
    var cursor = ctrlr.cursor.insAtRightEnd(block);

    ctrlr.moveLeft();
    assertSplit(cursor.jQ, 'abc', null);

    ctrlr.moveLeft();
    assertSplit(cursor.jQ, 'ab', 'c');

    ctrlr.moveLeft();
    assertSplit(cursor.jQ, 'a', 'bc');

    ctrlr.moveLeft();
    assertSplit(cursor.jQ, null, 'abc');

    ctrlr.moveRight();
    assertSplit(cursor.jQ, 'a', 'bc');

    ctrlr.moveRight();
    assertSplit(cursor.jQ, 'ab', 'c');

    ctrlr.moveRight();
    assertSplit(cursor.jQ, 'abc', null);
  });

  test('does not change latex as the cursor moves around', function() {
    var block = fromLatex('\\text{x}');
    var ctrlr = Controller(block, 0, 0);
    var cursor = ctrlr.cursor.insAtRightEnd(block);

    ctrlr.moveLeft();
    ctrlr.moveLeft();
    ctrlr.moveLeft();

    assert.equal(block.latex(), '\\text{x}');
  });

  suite('typing', function() {
    var mq, mostRecentlyReportedLatex;
    setup(function() {
      mostRecentlyReportedLatex = NaN; // != to everything
      mq = MQ.MathField($('<span></span>').appendTo('#mock')[0], {
        handlers: {
          edit: function() {
            mostRecentlyReportedLatex = mq.latex();
          }
        }
      });
    });

    function prayWellFormedPoint(pt) { prayWellFormed(pt.parent, pt[L], pt[R]); }
    function assertLatex(latex) {
      prayWellFormedPoint(mq.__controller.cursor);
      assert.equal(mostRecentlyReportedLatex, latex);
      assert.equal(mq.latex(), latex);
    }

    test('stepping out of an empty block deletes it', function() {
      var controller = mq.__controller;
      var cursor = controller.cursor;

      mq.latex('\\text{x}');
      assertLatex('\\text{x}');

      mq.keystroke('Left');
      assertSplit(cursor.jQ, 'x');
      assertLatex('\\text{x}');

      mq.keystroke('Backspace');
      assertSplit(cursor.jQ);
      assertLatex('');

      mq.keystroke('Right');
      assertSplit(cursor.jQ);
      assert.equal(cursor[L], 0);
      assertLatex('');
    });

    test('typing $ in a textblock splits it', function() {
      var controller = mq.__controller;
      var cursor = controller.cursor;

      mq.latex('\\text{asdf}');
      assertLatex('\\text{asdf}');

      mq.keystroke('Left Left Left');
      assertSplit(cursor.jQ, 'as', 'df');
      assertLatex('\\text{asdf}');

      mq.typedText('$');
      assertLatex('\\text{as}\\text{df}');
    });
  });
});
