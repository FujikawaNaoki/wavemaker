/*
 *  Copyright (C) 2008-2011 VMware, Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

dojo.provide("wm.base.widget.VirtualList");

dojo.declare("wm.VirtualListItem", null, {
	selected: false,
	className: 'wmlist-item',
	constructor: function(inList, inText, inImage) {
		this.list = inList;
		this.connections = [];
		this.create();
		this.setContent(inText, inImage);
	},
	destroy: function() {
		dojo.forEach(this.connections, function(inConnect) { dojo.disconnect(inConnect) });
	},
	create: function() {
		var n = this.domNode = document.createElement('div');
		dojo.addClass(n, this.className);
		this.makeConnections();
	},
	makeConnections: function() {
		this.connections = [
			dojo.connect(this.domNode, 'mouseover', this, 'mouseover'),
			dojo.connect(this.domNode, 'mouseout', this, 'mouseout'),
		        dojo.connect(this.domNode, 'click', this, function(evt) {
			    wm.onidle(this,'click',evt);
			}),
		       dojo.connect(this.domNode, 'dblclick', this, function(evt) {
			   wm.onidle(this, 'dblclick',evt);
		       })
		];
	},
	setContent: function(inContent) {
	    this.domNode.innerHTML = inContent;
	},
	getContent: function() {
		return this.domNode.innerHTML;
	},
	// events
	doOver: function() {
		dojo.addClass(this.domNode, this.className +'-over');
	},
	mouseover: function(e) {
		if (e&&e.currentTarget == this.domNode) {
			this.list._onmouseover(e, this);
		}
	},
	mouseout: function(e) {
		if (e.currentTarget == this.domNode)
			dojo.removeClass(this.domNode, this.className +'-over');
	},
	click: function(e) {
		this.list.onclick(e, this);
	},
	dblclick: function(e) {
		this.list.ondblclick(e, this);
	},
	select: function() {
		this.selected = true;
		dojo.addClass(this.domNode, this.className +'-selected');
	},
	deselect: function() {
		this.selected = false;
		dojo.removeClass(this.domNode, this.className +'-selected');
	}
});

dojo.declare("wm.VirtualList", wm.Control, {
        manageHistory: true,
	headerVisible: true,
	toggleSelect: false,
	width: "250px",
	height: "150px",
	box: "v",
	multiSelect: false,
	className: "wmlist",
	selectedItem: null,
	init: function() {
		this.inherited(arguments);
		this.items = [];
		this.selection = [];
		this.selectedItem = new wm.Variable({name: "selectedItem", owner: this}); // only use if multiSelect is false
		this.createHeaderNode();
		this.createListNode();
		this.domNode.appendChild(this.headerNode);
		this.domNode.appendChild(this.listNode);
		this.setHeaderVisible(this.headerVisible);
	    if (this.onselect)
		this.connect(this, "onSelect", this, "onselect"); // changed from onselect to onSelect for grid compatibility
	    if (this.ondeselect)
		this.connect(this, "onDeselect", this, "ondeselect");// changed from onselect to onSelect for grid compatibility
	    if (app._touchEnabled) {
		wm.conditionalRequire("lib.github.touchscroll.touchscroll");
		this._listTouchScroll = new TouchScroll(this.listNode, {/*elastic:true, */owner: this});
		this.listNode = this._listTouchScroll.scrollers.inner;
		this._listTouchScroll.scrollers.outer.style.position = "absolute";
		this._listTouchScroll.scrollers.outer.style.left = "0px";
		this._listTouchScroll.scrollers.outer.style.top = "0px";
		this.connect(this._listTouchScroll, "setupScroller", this, "postSetupScroller");
	    }

	},
    postSetupScroller: function() {
	var touchScrollOuter = this._listTouchScroll.scroller ? this._listTouchScroll.scroller.outer : null;
	if (touchScrollOuter) {
	    touchScrollOuter.style.width = "100%";
	}
    },
	dataSetToSelectedItem: function(inDataSet) {
		this.selectedItem.setLiveView((inDataSet|| 0).liveView);
		this.selectedItem.setType(inDataSet ? inDataSet.type : "any");
	},
	getCount: function() {
		return this.items.length;
	},
	getItem: function(inIndex) {
		return this.items[inIndex];
	},
	getItemByCallback: function(callback) {
	  for (var i= 0; i < this.getCount(); i++) {
	    var d = this.items[i].getData();
	    if (callback(d)) {
	      return this.items[i];
	    }
	  }
	},
	getItemByFieldName: function(inName, inValue) {
	  for (var i= 0; i < this.getCount(); i++) {
	    var d = this.items[i].getData();
	    if (d[inName] == inValue) {
	      return this.items[i];
	    }
	  }
	},

	// rendering
	createListNode: function() {
		this.listNode = document.createElement('div');
		this.listNode.flex = 1;
		dojo.addClass(this.listNode, "wmlist-list");

	},
	createHeaderNode: function() {
		this.headerNode = document.createElement('div');
		dojo.addClass(this.headerNode, "wmlist-header");
	},

    renderBounds: function() {
	this.inherited(arguments);
	var hidden = this.isAncestorHidden();
	if (!this._listTouchScroll && this.headerVisible && !hidden) {
	    wm.job(this.getRuntimeId() + ".postRenderBounds", 1, dojo.hitch(this, "postRenderBounds"));	    
	}
	if (this._listTouchScroll && !hidden) {
	    wm.job(this.getRuntimeId() + ".postTouchRenderBounds", 1, dojo.hitch(this, "postTouchRenderBounds"));
	}

    },
    postRenderBounds: function() {
	if (!this.isAncestorHidden()) {
	    var coords = dojo.marginBox(this.headerNode);
	    var bodyheight = this.getContentBounds().h - coords.h;
	    this.listNode.style.height = bodyheight + "px";
	}
    },
    postTouchRenderBounds: function() {
	var coords = dojo.marginBox(this.headerNode);
	var bodyheight = this.getContentBounds().h - coords.h;
	this._listTouchScroll.scrollers.outer.parentNode.height = bodyheight + "px";

	var b = this.getContentBounds();
	var s = this._listTouchScroll.scrollers.outer.style;
	var changed = s.width != (b.w + "px") || s.height != (b.h - coords.h) + "px";
	if (changed) {
	    this._listTouchScroll.scrollers.outer.parentNode.style.width = this.listNode.style.width = s.width = b.w + "px";
	    s.height = (b.h - coords.h) + "px";
	}
	this._listTouchScroll.scrollers.outer.style.top = "0px";//coords.h + "px";
	if (this.updateHeaderWidth)
	    this.updateHeaderWidth();
	if (changed) {
	    this._listTouchScroll.setupScroller();
	}
    },
	clear: function() {
		this._setHeaderVisible(false);
		while (this.getCount())
			this.removeItem(this.getCount()-1);
		this.deselectAll();
		this._setSelected(null);
	},
	createItem: function(inContent) {
		return new wm.VirtualListItem(this, inContent);
	},
	addItem: function(inContent, inIndex) {
		var li = this.createItem(inContent), ln = this.listNode;
		dojo.setSelectable(li.domNode, false);
		if (inIndex!= undefined) {
			this.items.splice(inIndex, 0, li);
			li.index = inIndex;
			this.selection.splice(inIndex, 0, false);
			this.updateItemIndexes(inIndex+1, 1);
			var sibling = ln.childNodes[inIndex];
			if (sibling)
				ln.insertBefore(li.domNode, ln.childNodes[inIndex]);
			else
				ln.appendChild(li.domNode);
		} else {
			this.items.push(li);
			li.index = this.items.length-1;
			ln.appendChild(li.domNode);
		}
	},
	removeItem: function(inIndex) {
		var li = this.getItem(inIndex);
		if (li) {
			this.listNode.removeChild(li.domNode);
			this.items.splice(inIndex, 1);
			this.selection.splice(inIndex, 1);
			this.updateItemIndexes(inIndex, -1);
			li.destroy();
		}
	},
	updateItemIndexes: function(inStart, inDelta) {
		for (var i= inStart, l=this.getCount(), li; i<l&&(li=this.items[i]); i++)
			li.index += inDelta;
	},
	removeItems: function(inIndexes) {
		for (var i=inIndexes.length, index; ((index=inIndexes[i])!= undefined); i--)
			this.removeItem(index);
	},
	modifyItem: function(inIndex, inContent) {
		var li = this.getItem(inIndex);
		(li ? li.setContent(inContent) : this.addItem(inContent));
	},
	// header rendering
	renderHeader: function(inHtml) {
		this.headerNode.innerHTML = inHtml;
	},
	_setHeaderVisible: function(inHeaderVisible) {
		this.headerNode.style.display = inHeaderVisible ? '' : 'none';
	},
	setHeaderVisible: function(inHeaderVisible) {
		this.headerVisible = inHeaderVisible;
		if (this.getCount()) {
			if (this.headerVisible)
				this.renderHeader();
			this._setHeaderVisible(this.headerVisible);
			this.reflow();
		}
	},
	// selection
	_setSelected: function(inItem) {
		this.selected = inItem;
		if (this.selected)
			this.selectedItem.setData(this.selected);
		else
			this.selectedItem.clearData();
	},
	addToSelection: function(inItem) {
		if (!inItem)
			return;
		this.selection[inItem.index] = true;
		this.lastSelected = this.selected;
		this._setSelected(inItem);
		inItem.select();
	},
	removeFromSelection: function(inItem) {
		this.selection[inItem.index] = false;
		inItem.deselect();
		this._setSelected(this.lastSelected);
	},
	deselectAll: function(ignoreSelectedItem) {
		dojo.forEach(this.items, function(i) {
			i.deselect();
		});
		this.selection = [];
		if (!ignoreSelectedItem) {
		    this._setSelected(null);
		    this.onSelectionChange();
		}
	},
	isSelected: function(inItem) {
		return this.selection[inItem.index];
	},
	ctrlSelect: function(inItem) {
		if (this.isSelected(inItem))
			this.eventDeselect(inItem);
		else
			this.eventSelect(inItem);
	},
	shiftSelect: function(inItem) {
		var t = s = (this.selected || this.lastSelected || 0).index, e = inItem.index, t;
		this.deselectAll();
		if (s > e) {
			s = e;
			e = t;
		}
		for (var i=s, li; i<=e && (li=this.getItem(i)); i++)
			this.addToSelection(li);
	},
	clickSelect: function(inItem, inEvent) {
	    var selectedIndexWas = this.getSelectedIndex();
		if (this.multiSelect && (inEvent.ctrlKey || inEvent.shiftKey)) {
			if (inEvent.ctrlKey)
				this.ctrlSelect(inItem);
			else if (inEvent.shiftKey)
				this.shiftSelect(inItem);
		} else if (this.multiSelect) {
		    if (dojo.indexOf(this.selected, inItem.index) == -1) {
			this.addToSelection(inItem);
		    } else {
			this.removeFromSelection(inItem);
		    }
		} else {
			var s = this.selected, oldIndex = s && s.index, newIndex = inItem.index;
			if (oldIndex !== newIndex){
			        this.eventDeselect(inItem,true);			        
				this.eventSelect(inItem);
			} else {
				if (this.toggleSelect)
					this.eventDeselect(inItem);
			}
		}
		if (!this._isDesignLoaded && !this._handlingBack && this.manageHistory) {
		    app.addHistory({id: this.getRuntimeId(),
				    options: {selectedRow: selectedIndexWas},
				    title: "SelectionChange"});
		}
	    
	},
    eventDeselect: function(inItem, ignoreSelectedItem) {
		if (this.multiSelect)
			this.removeFromSelection(inItem);
		else
			this.deselectAll(ignoreSelectedItem);
	    if (!ignoreSelectedItem) {
		this.onDeselect(inItem);
		this.onSelectionChange();
	    }
	},
	eventSelect: function(inItem) {
		var selectInfo = {canSelect: true};
		this._oncanselect(inItem, selectInfo);
		if (selectInfo.canSelect) {
			/* candidate for a wm.onidle, but unfortunately, that will make javascript calls that use this async and will likely fail */
			this.addToSelection(inItem);
			this.onSelect(inItem);
		    this.onSelectionChange();
		}
	},
	select: function(inItem) {
		if (inItem) {
			this.deselectAll();
			this.addToSelection(inItem);
		}
	},
	selectByIndex: function(inIndex) {
		var i = this.getItem(inIndex);
		if (i)
			this.select(i);
	},
	getSelectedIndex: function() {
		return this.selected ? this.selected.index : -1;
	},
    handleBack: function(inOptions) {
	this._handlingBack = true;
	try {
	    var selectedRow = inOptions.selectedRow;
	    this.select(selectedRow);
	} catch(e) {}
	delete 	this._handlingBack;
	return true;
    },
	// events
	_oncanmouseover: function(inEvent, inItem, inMouseOverInfo) {
	},
	onclick: function(inEvent, inItem) {
		this.clickSelect(inItem, inEvent);
	},
	ondblclick: function(inEvent, inItem) {
	},
    onSelectionChange: function() {}, // Added for DojoGrid compatability
	onselect: function(inItem) {
	},
	ondeselect: function(inItem) {
	},
	onSelect: function(inItem) {
	},
	onDeselect: function(inItem) {
	},

	_oncanselect: function(inItem, inSelectInfo) {
	},
	_onmouseover: function(inEvent, inItem) {
		var mouseOverInfo = {canMouseOver: true};
		this._oncanmouseover(inEvent, inItem, mouseOverInfo);
		if (mouseOverInfo.canMouseOver) {
			inItem.doOver();
		}
	}
});

