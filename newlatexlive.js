/**
* Usage:
* $(thing).latexlive();
* turns thing into a live editable thingy.
* AMAZORZ.
*
* Note: doesn't actually work.
*
*/

jQuery.fn.latexlive = (function() {

var $ = jQuery, noop = function(){ return this; }, todo = function(){ alert('BLAM!\n\nAHHHHHH!\n\n"Oh god, oh god, I\'ve never seen so much blood!"\n\nYeah, that doesn\'t fully work yet.'); };

/**
 * MathElement is the core Math DOM tree node prototype.
 * Both MathBlock's and MathCommand's descend from it.
 */
function MathElement(){}
MathElement.prototype = { 
  prev: null,
  next: null,
  parent: null,
  firstChild: null,
  lastChild: null,
  eachChild: function(fn)
  {
    for(var child = this.firstChild; child !== null; child = child.next)
      fn.call(child);
    return this;
  },
  reduceChildren: function(fn, initVal)
  {
    this.eachChild(function(){
      initVal = fn.call(this, initVal);
    });
    return initVal;
  },
  isEmpty: function()
  {
    return this.firstChild === null && this.lastChild === null;
  },
}

/**
 * Children and parent of MathCommand's. Basically partitions all the
 * symbols and operators that descend (in the Math DOM tree) from
 * ancestor operators.
 */
function MathBlock(){}
MathBlock.prototype = $.extend(new MathElement, { 
  latex: function()
  {
    return this.reduceChildren(function(initVal){
      return initVal + this.latex();
    }, '');
  },
});

/**
 * Commands and operators, like subscripts, exponents, or fractions.
 * May contain descendant commands, organized into blocks.
 */
function MathCommand(cmd, num_blocks, html_template)
{ 
  if(!arguments.length)
    return;
  this.cmd = cmd;
  this.num_blocks = num_blocks;
  this.html_template = html_template;
  this.jQinit();
  this.initBlocks();
}
MathCommand.prototype = $.extend(new MathElement, {
  jQinit: function()
  {
    return this.jQ = $(this.html_template).data('latexlive', {cmd: this});
  },
  initBlocks: function()
  {
    var newBlock, prev = null, children = this.jQ.children();
    for(var i = 0; i < this.num_blocks; i += 1)
    {
      newBlock = new MathBlock;
      newBlock.jQ = $(children[i]).data('latexlive', {block: newBlock}); /*** optimize me! ***/
      newBlock.parent = this;
      newBlock.prev = prev;
      if(prev)
        prev.next = newBlock;
      else
        this.firstChild = newBlock;
      prev = newBlock;
    }
    this.lastChild = newBlock;
  },
  latex: function()
  {
    return this.cmd + this.reduceChildren(function(initVal){
      return initVal + '{' + this.latex() + '}';
    }, '');
  },
  remove: function()
  {
    if(this.prev)
      this.prev.next = this.next;
    else
      this.parent.firstChild = this.next;
    
    if(this.next)
      this.next.prev = this.prev;
    else
      this.parent.lastChild = this.prev;
    
    this.jQ.remove();
    
    return this;
  },
  //placeholder for context-sensitive spacing.
  respace: noop,
  placeCursor: function(cursor)
  {
    cursor.prependTo(this.firstChild);
    return this;
  },
});

/**
 * Lightweight command without blocks or children.
 */
function Symbol(cmd, html)
{
  MathCommand.call(this, cmd, 0, html);
}
Symbol.prototype = $.extend(new MathCommand, {
  initBlocks: noop,
  latex: function()
  {
    return this.cmd;
  },
  placeCursor: noop,
});

function VanillaSymbol(ch, html) 
{
  Symbol.call(this, ch, '<span>'+(html || ch)+'</span>');
}
VanillaSymbol.prototype = Symbol.prototype;

function Variable(ch)
{
  Symbol.call(this, ch, '<i>'+ch+'</i>');
}
Variable.prototype = Symbol.prototype;

function BinaryOperator(cmd, html)
{
  Symbol.call(this, cmd, '<span class="operator">'+html+'</span>');
}
BinaryOperator.prototype = Symbol.prototype;

function PlusMinus(cmd, html)
{
  VanillaSymbol.apply(this, arguments);
}
PlusMinus.prototype = new BinaryOperator('PlusMinus.prototype'); //so instanceof will work
PlusMinus.prototype.respace = function()
{
  if(!this.prev || this.prev instanceof BinaryOperator)
    this.jQ.removeClass('operator');
  else
    this.jQ.addClass('operator');
  return this;
};

function SupSub(cmd, html)
{
  MathCommand.call(this, cmd, 1, html);
}
SupSub.prototype = $.extend(new MathCommand, {
  initBlocks: function()
  {
    this.jQ.data('latexlive').block = this.firstChild = this.lastChild = new MathBlock;
    this.firstChild.jQ = this.jQ;
  },
  respace: function()
  {
    if(this.respaced = this.prev instanceof SupSub && this.prev.cmd != this.cmd && !this.prev.respaced)
      this.jQ.css({
        left: -this.prev.jQ.innerWidth(),
        marginRight: -Math.min(this.jQ.innerWidth(), this.prev.jQ.innerWidth())
      });
    else
      this.jQ.css({
        left: 0,
        marginRight: 0
      });
    return this;
  }
});

//A fake cursor in the fake textbox that the math is rendered in.
function Cursor(block)
{
  //API for the blinking cursor
  var intervalId;
  this.show = function()
  {
    if(intervalId)
      clearInterval(intervalId);
    this.jQ.removeClass('blink');
    var cursor = this;
    intervalId = setInterval(function(){
      cursor.jQ.toggleClass('blink');
    }, 500);
    return this;
  };
  this.hide = function()
  {
    if(intervalId)
      clearInterval(intervalId);
    intervalId = undefined;
    this.jQ.addClass('blink');
    return this;
  };
  
  this.jQ = $('<span class="cursor"></span>');
  if(block)
    this.prependTo(block);
}
Cursor.prototype = {
  prev: null,
  next: null,
  parent: null,
  setParentEmpty: function()
  {
    if(this.parent)
    {
      this.parent.jQ.removeClass('hasCursor');
      if(this.parent.isEmpty())
      {
        this.parent.jQ.addClass('empty');
        if(this.parent.parent)
          this.parent.jQ.html('[ ]');
      }
    }
    return this;
  },
  rmParentEmpty:function()
  {
    if(this.parent.jQ.hasClass('empty'))
      this.parent.jQ.html('').removeClass('empty');
    return this;
  },
  detach: function()
  {
    this.setParentEmpty();
    this.prev = this.next = this.parent = null;
    this.jQ.detach();
    return this;
  },
  insertBefore: function(el)
  {
    this.setParentEmpty();
    this.next = el;
    this.prev = el.prev;
    this.parent = el.parent;
    this.parent.jQ.addClass('hasCursor');
    this.jQ.insertBefore(el.jQ); 
    return this;
  },
  insertAfter: function(el)
  {
    this.setParentEmpty();
    this.prev = el;
    this.next = el.next
    this.parent = el.parent;
    this.parent.jQ.addClass('hasCursor');
    this.jQ.insertAfter(el.jQ);
    return this;
  }, 
  prependTo: function(el)
  {
    this.setParentEmpty();
    this.next = el.firstChild;
    this.prev = null;
    this.parent = el;
    this.rmParentEmpty();
    this.parent.jQ.addClass('hasCursor');
    this.jQ.prependTo(el.jQ);
    return this;
  },
  appendTo: function(el)
  {
    this.setParentEmpty();
    this.prev = el.lastChild;
    this.next = null;
    this.parent = el;
    this.rmParentEmpty();
    this.parent.jQ.addClass('hasCursor');
    this.jQ.appendTo(el.jQ);
    return this;
  },
  moveLeft: function()
  {
    if(this.selection)
      this.insertBefore(this.selection.prev ? this.selection.prev.next : this.parent.firstChild).clearSelection();
    else
      if(this.prev)
        if(this.prev.lastChild)
          this.appendTo(this.prev.lastChild)
        else
          this.hopLeft();
      else //we're at the beginning of a block
        if(this.parent.prev)
          this.appendTo(this.parent.prev);
        else if(this.parent.parent)
          this.insertBefore(this.parent.parent);
    //otherwise we're at the beginning of the root, so do nothing.
    return this.show();
  },
  moveRight: function()
  {
    if(this.selection)
      this.insertAfter(this.selection.next ? this.selection.next.prev : this.parent.lastChild).clearSelection();
    else
      if(this.next)
        if(this.next.firstChild)
          this.prependTo(this.next.firstChild)
        else
          this.hopRight();
      else //we're at the end of a block
        if(this.parent.next)
          this.prependTo(this.parent.next);
        else if(this.parent.parent)
          this.insertAfter(this.parent.parent);
    //otherwise we're at the end of the root, so do nothing.
    return this.show();
  },
  hopLeft: function()
  {
    this.jQ.insertBefore(this.prev.jQ);
    this.next = this.prev;
    this.prev = this.prev.prev;
    return this;
  },
  hopRight: function()
  {
    this.jQ.insertAfter(this.next.jQ);
    this.prev = this.next;
    this.next = this.next.next;
    return this;
  },
  newBefore: function(el)
  {
    this.deleteSelection();
    el.parent = this.parent; 
    el.next = this.next;
    el.prev = this.prev;
    if(this.prev)
      this.prev.next = el;
    else
      this.parent.firstChild = el;
    if(this.next)
      this.next.prev = el;
    else
      this.parent.lastChild = el;
    el.jQ.insertBefore(this.jQ); 

    //adjust context-sensitive spacing
    el.respace();
    if(this.next)
      this.next.respace();
    if(this.prev)
      this.prev.respace();

    this.prev = el;

    el.placeCursor(this);

    this.jQ.change();
    
    return this;
  },
  backspace: function()
  {
    if(this.deleteSelection());
    else if(this.prev && this.prev.isEmpty())
      this.prev = this.prev.remove().prev;
    else if(!this.prev && this.parent.parent && this.parent.parent.isEmpty())
      return this.insertAfter(this.parent.parent).backspace();
    else
      this.selectLeft();
    
    this.jQ.change();
    if(this.prev)
      this.prev.respace();
    if(this.next)
      this.next.respace();
    
    return this;
  },
  deleteForward: function()
  {
    if(this.deleteSelection());
    else if(this.next && this.next.isEmpty())
      this.next = this.next.remove().next;
    else if(!this.next && this.parent.parent && this.parent.parent.isEmpty())
      return this.insertBefore(this.parent.parent).deleteForward();
    else
      this.selectRight();
    
    this.jQ.change();
    if(this.prev)
      this.prev.respace();
    if(this.next)
      this.next.respace();
    
    return this;
  },
  selectLeft: function()
  {
    if(this.selection)
      if(this.selection.prev === this.prev) //if cursor is at left edge of selection,
      {
        if(this.prev) //then extend left if possible
        {
          this.prev.jQ.prependTo(this.selection.jQ);
          this.hopLeft();
          this.selection.prev = this.prev;
        }
        else if(this.parent.parent) //else level up if possible
          this.insertBefore(this.parent.parent).selection.levelUp();
      }
      else //else cursor is at right edge of selection, retract left
      {
        this.prev.jQ.insertAfter(this.selection.jQ);
        this.hopLeft();
        this.selection.next = this.next;
        if(this.selection.prev === this.prev)
          this.deleteSelection();
      }
    else
      if(this.prev)
        this.hopLeft().hide().selection = new Selection(this.parent, this.prev, this.next.next, true);
      else //end of a block
        if(this.parent.parent)
          this.insertBefore(this.parent.parent).hide().selection = new Selection(this.parent, this.next.next, this.prev, true);
  },
  selectRight: function()
  {
    if(this.selection)
      if(this.selection.next === this.next) //if cursor is at right edge of selection,
      {
        if(this.next) //then extend right if possible
        {
          this.next.jQ.appendTo(this.selection.jQ);
          this.hopRight();
          this.selection.next = this.next;
        }
        else if(this.parent.parent) //else level up if possible
          this.insertAfter(this.parent.parent).selection.levelUp();
      }
      else //else cursor is at left edge of selection, retract right
      {
        this.next.jQ.insertBefore(this.selection.jQ);
        this.hopRight();
        this.selection.prev = this.prev;
        if(this.selection.next === this.next)
          this.deleteSelection();
      }
    else
      if(this.next)
        this.hopRight().hide().selection = new Selection(this.parent, this.prev.prev, this.next, true);
      else //end of a block
        if(this.parent.parent)
          this.insertAfter(this.parent.parent).hide().selection = new Selection(this.parent, this.prev.prev, this.next, true);
  },
  clearSelection: function()
  {
    if(this.show().selection)
    {
      this.selection.clear();
      delete this.selection;
    }
    return this;
  },
  deleteSelection: function()
  {
    if(this.show().selection)
    {
      this.selection.remove();
      delete this.selection;
      return true;
    }
    else
      return false;
  },
}

//A fake selection in the fake textbox that the math is rendered in.
function Selection(parent, prev, next, highlight)
{
  this.parent = parent;
  this.prev = prev;
  this.next = next;
  
  this.jQ = this.reduce(function(initVal){ return initVal.add(this.jQ); }, $())
    .wrapAll('<span'+(highlight?' class="highlight"':'')+'></span>').parent();
    //wrapAll clones, so can't do .wrapAll(this.jQ = $(...));
}
Selection.prototype = {
  remove: MathCommand.prototype.remove,
  clear: function()
  {
    this.jQ.replaceWith(this.jQ.children());
    return this;
  },
  each: function(fn)
  {
    for(var el = (this.prev ? this.prev.next : this.parent.firstChild); el !== this.next; el = el.next)
      fn.call(el);
    return this;
  },
  reduce: function(fn, initVal)
  {
    this.each(function()
    {
      initVal = fn.call(this, initVal);
    });
    return initVal;
  },
  levelUp: function()
  {
    this.jQ.children().unwrap();
    this.jQ = this.parent.parent.jQ.wrap(this.jQ).parent();

    this.parent = this.parent.parent.parent;
    this.prev = this.parent.parent.prev;
    this.next = this.parent.parent.next;
  },
};

//on document ready, replace the contents of all <tag class="latexlive-embedded-math"></tag> elements
//with RootMathBlock's.
$(function(){
  $('.latexlive-embedded-math').latexlive();
});

//The actual, publically exposed method of jQuery.prototype, available
//(and meant to be called) on jQuery-wrapped HTML DOM elements.
return function(tabindex)
{
  if(!(typeof tabindex === 'function'))
  {
    var html = '<span class="latexlive-generated-math" tabindex="'+(tabindex || 0)+'"></span>';
    tabindex = function(){ return html; };
  }
  return this.each(function()
  {
    var math = new MathBlock;
    math.jQ = $(tabindex.apply(this, arguments)).data('latexlive', {block: math}).replaceAll(this);
    var cursor = math.cursor = new Cursor(math);
    
    var continueDefault, lastKeydnEvt; //see Wiki page "Keyboard Events"
    math.jQ.focus(function()
    {
      if(cursor.parent)
      {
        if(cursor.parent.isEmpty())
          cursor.rmParentEmpty().jQ.appendTo(cursor.parent.jQ);
      }
      else
        cursor.appendTo(root);
      cursor.parent.jQ.addClass('hasCursor');
      if(!cursor.selection)
        cursor.show();
    }).blur(function(e){
      cursor.setParentEmpty().hide();
    }).click(function(e)
    {
      var clicked = $(e.target);
      if(clicked.hasClass('empty'))
      {
        cursor.prependTo(clicked.data('latexlive').block);
        return false;
      }
      var cmd = clicked.data('latexlive');
      //all clickables not MathCommands are either LatexBlocks or like sqrt radicals or parens,
      //both of whose immediate parents are LatexCommands
      if((!cmd || !(cmd = cmd.cmd)) && (!(cmd = (clicked = clicked.parent()).data('latexlive')) || !(cmd = cmd.cmd))) 
        return;
      cursor.clearSelection();
      if((e.pageX - clicked.offset().left)*2 < clicked.outerWidth())
        cursor.insertBefore(cmd);
      else
        cursor.insertAfter(cmd);
      return false;
    }).keydown(function(e)
    {
      //see Wiki page "Keyboard Events"
      lastKeydnEvt = e;
      e.happened = true;
      continueDefault = false;
      
      e.ctrlKey = e.ctrlKey || e.metaKey;
      switch(e.which)
      {
        case 8: //backspace
          if(e.ctrlKey)
            while(cursor.prev)
              cursor.backspace();
          else
            cursor.backspace();
          return false;
        case 27: //esc does something weird in keypress, may as well be the same as tab until we figure out what to do with it
        case 9: //tab
          var parent = cursor.parent, gramp = parent.parent;
          if(e.shiftKey) //shift+Tab = go one block left if it exists, else escape left.
          {
            if(!gramp) //cursor is in the root, continue default
              return continueDefault = true;
            parent = cursor.parent;
            gramp = parent.parent;
            if(parent.position == 0) //escape
              cursor.insertBefore(gramp);
            else //move one block left
              cursor.appendTo(gramp.blocks[parent.position-1]);
          }
          else //plain Tab = go one block right if it exists, else escape right.
          {
            if(!gramp) //cursor is in the root, continue default
              return continueDefault = true;
            parent = cursor.parent;
            gramp = parent.parent;
            if(parent.position == gramp.blocks.length - 1) //escape this block
              cursor.insertAfter(gramp);
            else //move one block right
              cursor.prependTo(gramp.blocks[parent.position+1]);
          }
          cursor.clearSelection();
          return false;
        case 13: //enter
          return false;
        case 35: //end
          if(e.ctrlKey) //move to the end of the root math block.
            cursor.clearSelection().appendTo(math);
          else //else move to the end of the current block.
            cursor.clearSelection().appendTo(cursor.parent);
          return false;
        case 36: //home
          if(e.ctrlKey) //move to the start of the root math block.
            cursor.clearSelection().prependTo(math);
          else //else move to the start of the current block.
            cursor.clearSelection().prependTo(cursor.parent);
          return false;
        case 37: //left
          if(e.shiftKey)
            cursor.selectLeft();
          else
            cursor.moveLeft();
          return false;
        case 38: //up
          return false;
        case 39: //right
          if(e.shiftKey)
            cursor.selectRight();
          else
            cursor.moveRight();
          return false;
        case 40: //down
          return false;
        case 46: //delete
          if(e.ctrlKey)
            while(cursor.next)
              cursor.deleteForward();
          else
            cursor.deleteForward();
          return false;
        default:
          continueDefault = null; //as in 'neither'. Do nothing, pass to keypress.
          return;
      }
    }).keypress(function(e)
    {
      //on auto-repeat, keypress may get triggered but not keydown (see Wiki page "Keyboard Events")
      if(!lastKeydnEvt.happened)
        $(this).trigger(lastKeydnEvt);
      
      if(continueDefault !== null)
      {
        lastKeydnEvt.happened = false;
        return continueDefault;
      }
      
      if(e.ctrlKey || e.metaKey)
        return; //don't capture Ctrl+anything.
      
      var cmd = String.fromCharCode(e.which);
      if(cmd.match(/[a-z]/i))
        cmd = new Variable(cmd);
      else if(cmd.match(/\d/))
        cmd = new VanillaSymbol(cmd);
      else
        return todo(), false;
      
      cursor.newBefore(cmd);
      
      return false;
    }).focus();
  });
};

})();
