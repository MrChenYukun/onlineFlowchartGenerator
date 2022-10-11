document.onload = (function (d3, saveAs, Blob, undefined) {
  "use strict";

  // define graphcreator object
  var GraphCreator = function (svg, nodes, edges) {
    var thisGraph = this;
    console.log('thisGraph:');
    console.log(thisGraph);

    thisGraph.idct = 0;

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null,
      drawLine: false
    };

    // define arrow markers for graph links
    var defs = svg.append('defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "32")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    //define arrow markers for leading arrow
    defs.append('marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg;
    thisGraph.svgG = svg.append("g")
      .classed(thisGraph.consts.graphClass, true);
    var svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0')
      .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.circles = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
      .origin(function (d) {
        // d = selected circle. The drag origin is the origin of the circle
        return {
          x: d.x,
          y: d.y
        };
      })
      .on("drag", function (args) {
        thisGraph.state.justDragged = true;
        thisGraph.dragmove.call(thisGraph, args);
      })
      .on("dragend", function (args) {
        // args = circle that was dragged
      });

    // listen for key events
    d3.select(window).on("keydown", function () {
        thisGraph.svgKeyDown.call(thisGraph);
      })
      .on("keyup", function () {
        thisGraph.svgKeyUp.call(thisGraph);
      });
    svg.on("mousedown", function (d) {
      thisGraph.svgMouseDown.call(thisGraph, d);
    });
    svg.on("mouseup", function (d) {
      thisGraph.svgMouseUp.call(thisGraph, d);
    });

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
      .on("zoom", function () {
        console.log('zoom triggered');
        if (d3.event.sourceEvent.shiftKey) {
          // TODO  the internal d3 state is still changing
          return false;
        } else {
          thisGraph.zoomed.call(thisGraph);
        }
        return true;
      })
      .on("zoomstart", function () {
        var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
        if (ael) {
          ael.blur();
        }
        if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
      })
      .on("zoomend", function () {
        d3.select('body').style("cursor", "auto");
      });

    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function () {
      thisGraph.updateWindow(svg);
    };

    // help icon click
    d3.select("#help").on("click", function () {
      $('#helpbox').removeClass('hidden');
    });

    // reset zoom
    d3.select("#reset-zoom").on("click", function () {
      d3.select(".graph")
        .transition() // start a transition
        .duration(1000) // make it last 1 second
        .attr('transform', "translate(1,0)");

      dragSvg.scale(1);
      dragSvg.translate([1, 0]);
    });

    // handle download data
    d3.select("#download-input").on("click", function () {
      var saveEdges = [];
      thisGraph.edges.forEach(function (val, i) {
        saveEdges.push({
          source: val.source.id,
          target: val.target.id
        });
      });
      var blob = new Blob([window.JSON.stringify({
        "nodes": thisGraph.nodes,
        "edges": saveEdges
      })], {
        type: "text/plain;charset=utf-8"
      });
      saveAs(blob, "mydag.json");
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function () {
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function () {
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function () {
          var txtRes = filereader.result;
          // TODO better error handling
          try {
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function (e, i) {
              newEdges[i] = {
                source: thisGraph.nodes.filter(function (n) {
                  return n.id == e.source;
                })[0],
                target: thisGraph.nodes.filter(function (n) {
                  return n.id == e.target;
                })[0]
              };
            });
            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          } catch (err) {
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function () {
      thisGraph.deleteGraph(false);
    });

    $('#flowComponents .components-btn').not('.noComponent').attr('draggable', 'true').on('dragstart', function (ev) {
      ev.originalEvent.dataTransfer.setData('text', $(this).children('span').text());
      ev.originalEvent.dataTransfer.setData('shapename', $(this).attr('for-name'));
      ev.originalEvent.dataTransfer.setData('component', $(this).attr('name'));
      console.log('drag start');
      console.log('shapename:' + $(this).attr('for-name') + ';shapeLabel:' + $(this).children('span').text());
      // $('#reset-zoom').trigger("click");
    });
    //creat
    $('#container').on('drop', function (ev) {
      var position = {};
      position.x = parseInt(ev.originalEvent.offsetX),
        position.y = parseInt(ev.originalEvent.offsetY);
      var shapeLabel = ev.originalEvent.dataTransfer.getData('text'),
        shapename = ev.originalEvent.dataTransfer.getData('shapename'),
        component = ev.originalEvent.dataTransfer.getData('component'),
        shapeId = shapename + new Date().getTime();

      var d = {
        id: thisGraph.idct++,
        title: shapeLabel,
        x: position.x,
        y: position.y,
        eventTypeId: null,
        name: component,
        state: 0
      };
      console.log(d);
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();

    }).on('dragover', function (ev) {
      ev.preventDefault();
      console.log('drag over');
    });
    //选择左侧工具
    $('#flowComponents .components-btn').on('click', function () {
      $(this).siblings().removeClass('active').end().addClass('active');
      if ('drawLineBtn' == $(this).attr('name')) {
        thisGraph.state.drawLine = true;
        $('#container').on('mouseover mouseout', '.conceptG', function () {
          if (event.type == 'mouseover') {
            this.style.cursor = 'crosshair';
          } else if (event.type == 'mouseout') {
            this.style.cursor = 'default';
          }
        });
      } else {
        $('#container').off('mouseover mouseout', '.conceptG');
        thisGraph.state.drawLine = false;
      }
    });

  };

  //constant config
  GraphCreator.prototype.consts = {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50,
    startComponent: "M -60 -50 A 5 7 0 1 0 -60 50 L 60 50 A 5 7 0 1 0 60 -50 Z ",
    activityComponent: "M -100 -50 L 100 -50 L 100 50 L -100 50 Z",
    branchComponent: "M 0 -50 L -100 0 L 0 50 L 100 0 Z",
    connecterComponent: "M 0 -50 A 10 10 0 1 0 0 50 A 10 10 0 1 0 0 -50 Z",
    pageconnecterComponent: "M 0 -40 A 5 5 0 1 0 0 40 A 5 5 0 1 0 0 -40 Z",
    databaseComponent: " M -60 -50 A 5 7 0 1 0 -60 50 L 60 50 A 5 7 0 1 0 60 -50 A 5 7 0 1 0 60 50 A 5 7 0 1 0 60 -50 Z",
    fileComponent: "M -100 -50 L -100 30 A 10 4 0 1 0 0 30 A 10 4 0 1 1 100 30 L 100 -50 Z",
    endComponent: "M -60 -50 A 5 7 0 1 0 -60 50 L 60 50 A 5 7 0 1 0 60 -50 Z "
  };

  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.dragmove = function (d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag || thisGraph.state.drawLine) {
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else {
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function (skipPrompt) {
    var thisGraph = this,
      doDelete = true;
    if (!skipPrompt) {
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if (doDelete) {
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function (el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, d) {
    gEl.select("text").remove();

    var words = d.title.split(/;/),
      nwords = words.length;
    var el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-" + (nwords - 1) * 7.5);

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }

    if (d.name == "branchComponent") {
      //for if branch
      if (d.state == 0) {
        el.append("tspan").text("T").attr('x', -80).attr('y', 5);
        el.append("tspan").text("F").attr('x', 80).attr('y', 5);
      }
      //for while branch
      else if (d.state == 1) {
        el.append("tspan").text("T").attr('x', 0).attr('y', 40);
        el.append("tspan").text("F").attr('x', 80).attr('y', 5);
      }
      //for do-while branch
      else if (d.state == 2) {
        el.append("tspan").text("T").attr('x', -80).attr('y', 5);
        el.append("tspan").text("F").attr('x', 0).attr('y', 40);
      }
    }

    return;
  };


  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function (node) {
    var thisGraph = this,
      toSplice = thisGraph.edges.filter(function (l) {
        return (l.source === node || l.target === node);
      });
    toSplice.map(function (l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function (d3Path, edgeData) {
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge) {
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function (d3Node, nodeData) {
    // A circle node has been selected.

    var thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;

  };

  GraphCreator.prototype.removeSelectFromNode = function () {
    // A circle node has been deselected.

    var thisGraph = this;
    thisGraph.circles.filter(function (cd) {
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;

    d3.selectAll("div#inspector").remove();

  };

  GraphCreator.prototype.removeSelectFromEdge = function () {
    var thisGraph = this;
    thisGraph.paths.filter(function (cd) {
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function (d3path, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;

    if (state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d) {
      thisGraph.replaceSelectEdge(d3path, d);
    } else {
      thisGraph.removeSelectFromEdge();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function (d3node, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;

    if (d3.event.shiftKey || thisGraph.state.drawLine) {
      // Automatically create node when they shift + drag?
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function (d3node, d) {
    //console.log('circle mouse up');
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d) {
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {
        source: mouseDownNode,
        target: d
      };

      thisGraph.edges.push(newEdge);
      thisGraph.updateGraph();
    } else {
      // we're in the same node
      var prevNode = state.selectedNode;
      if (state.justDragged) {
        // dragged, not clicked
        if (state.selectedEdge) {
          thisGraph.removeSelectFromEdge();
        }
        if (!prevNode || prevNode !== d) {
          thisGraph.removeSelectFromNode();
          thisGraph.replaceSelectNode(d3node, d);
        } else {
          // thisGraph.removeSelectFromNode();
        }

      } else {
        // clicked, not dragged
        if (d3.event.shiftKey) {

        } else {
          if (state.selectedEdge) {
            thisGraph.removeSelectFromEdge();
          }
          if (!prevNode || prevNode !== d) {
            thisGraph.replaceSelectNode(d3node, d);
            // thisGraph.menuEvent();
          } else {
            thisGraph.removeSelectFromNode();
          }
        }
      }
    }

    thisGraph.updateGraph();
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function () {
    this.state.graphMouseDown = true;
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function () {
    var thisGraph = this,
      state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey) {
      // clicked not dragged from svg
      var xycoords = d3.mouse(thisGraph.svgG.node()),
        d = {
          id: thisGraph.idct++,
          title: "",
          x: xycoords[0],
          y: xycoords[1],
          eventTypeId: null
        };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
    } else if (state.shiftNodeDrag || state.drawLine) {
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function () {
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if (state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
      selectedEdge = state.selectedEdge;

    switch (d3.event.keyCode) {
      case consts.BACKSPACE_KEY:
      case consts.DELETE_KEY:
        d3.event.preventDefault();
        if (selectedNode) {
          thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
          thisGraph.spliceLinksForNode(selectedNode);
          state.selectedNode = null;
          thisGraph.updateGraph();
          // thisGraph.
        } else if (selectedEdge) {
          thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
          state.selectedEdge = null;
          thisGraph.updateGraph();
        }
        break;
    }
  };

  GraphCreator.prototype.svgKeyUp = function () {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  //update rectangle
  GraphCreator.prototype.updateGraph = function () {

    var thisGraph = this,
      consts = thisGraph.consts,
      state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function (d) {
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var paths = thisGraph.paths;
    // update existing paths
    console.log(paths);
    paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function (d) {
        return d === state.selectedEdge;
      })
      .attr("d", function (d) {
        //源头是分支块的情况比较复杂
        if (d.source.name == "branchComponent") {
          // if-branch
          if (d.source.state == 0) {
            return "M" + d.source.x + "," + d.source.y +
              "L" + d.target.x + "," + d.source.y +
              "L" + d.target.x + "," + d.target.y;
          }
          //while-branch
          else if (d.source.state == 1) {
            if (abs(d.target.y - d.source.y) > 300) {
              return "M" + d.source.x + "," + d.source.y +
                "L" + (d.source.x + 180) + "," + d.source.y +
                "L" + (d.source.x + 180) + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + d.target.y;
            } else {
              return "M" + d.source.x + "," + d.source.y +
                "L" + d.target.x + "," + d.source.y +
                "L" + d.target.x + "," + d.target.y;
            }
          }
          //do-while branch
          else if (d.source.state == 2) {
            //在上方
            if (d.target.y < d.source.y) {
              return "M" + d.source.x + "," + d.source.y +
                "L" + (d.source.x - 180) + "," + d.source.y +
                "L" + (d.source.x - 180) + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + d.target.y;
            }
            else {
              return "M" + d.source.x + "," + d.source.y +
                "L" + d.target.x + "," + d.source.y +
                "L" + d.target.x + "," + d.target.y;
            }
          }
        }
        //如果目标是分支，且状态为2，也是拐着连接
        else if (d.target.name == "branchComponent" && d.target.state == 1 && d.target.y < d.source.y) {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.source.x + "," + (d.source.y + 100) +
            "L" + (d.source.x - 180) + "," + (d.source.y + 100) +
            "L" + (d.source.x - 180) + "," + (d.target.y - 100) +
            "L" + d.target.x + "," + (d.target.y - 100) +
            "L" + d.target.x + "," + d.target.y;
        } 
        //如果目标是分支,结束，或者流程只能上下被连接
        else if (d.target.name == "branchComponent" ||
          d.target.name == "activityComponent" ||
          d.target.name == "endComponent") {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.target.x + "," + d.source.y +
            "L" + d.target.x + "," + d.target.y;
        }
        //如果源头是开始或流程块，只能上下伸出边
        else if (d.source.name == "activityComponent" ||
          d.source.name == "startComponent") {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.source.x + "," + d.target.y +
            "L" + d.target.x + "," + d.target.y;
        }
        //上下箭头
        else if (abs(d.target.x - d.source.x) < abs(d.target.y - d.source.y)) {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.target.x + "," + d.source.y +
            "L" + d.target.x + "," + d.target.y;
        }
        //左右箭头
        else {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.source.x + "," + d.target.y +
            "L" + d.target.x + "," + d.target.y;
        }
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end', 'url(#end-arrow)')
      .classed("link", true)
      .attr("d", function (d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function (d) {
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function (d) {
        state.mouseDownLink = null;
      });

    // remove old links
    paths.exit().remove();

    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function (d) {
      return d.id;
    });
    thisGraph.circles.attr("transform", function (d) {
      return "translate(" + d.x + "," + d.y + ")";
    });

    // add new nodes
    var newGs = thisGraph.circles.enter()
      .append("g")
      .attr({
        "id": function (d) {
          return generateUUID();
        }
      });

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      })
      .on("mouseover", function (d) {
        console.log('on mouse over d:');
        if (state.shiftNodeDrag) {
          d3.select(this).classed(consts.connectClass, true);
        }
      })
      .on("mouseout", function (d) {
        console.log('on mouse out d:');
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function (d) {
        console.log('on mouse down d:');
        console.log(d);
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function (d) {
        console.log('on mouse up d:');
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      .on("click", function (d) {
        console.log('on click d:');
        console.log(d);
        thisGraph.circleClick.call(thisGraph, d3.select(this), d)
      })
      .on("dblclick", function (d) {
        console.log('on double click d:');
        thisGraph.circleDoubleClick.call(thisGraph, d3.select(this), d);
      })
      .call(thisGraph.drag);
    //add circle
    // newGs.append("circle")
    //   .attr("r", String(consts.nodeRadius));

    newGs.append("path")
      .attr("d", function (d) {
        if (d.name == "startComponent") {
          return consts.startComponent;
        } else if (d.name == "activityComponent") {
          return consts.activityComponent;
        } else if (d.name == "branchComponent") {
          return consts.branchComponent;
        } else if (d.name == "connecterComponent") {
          return consts.connecterComponent;
        } else if (d.name == "pageconnecterComponent") {
          return consts.pageconnecterComponent;
        } else if (d.name == "databaseComponent") {
          return consts.databaseComponent;
        } else if (d.name == "fileComponent") {
          return consts.fileComponent;
        } else if (d.name == "endComponent") {
          return consts.endComponent;
        } else {
          return consts.activityComponent;
        }
      });


    newGs.each(function (d) {
      thisGraph.insertTitleLinebreaks(d3.select(this), d);
    });

    // remove old nodes
    thisGraph.circles.exit().remove();
  };

  GraphCreator.prototype.zoomed = function () {
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  };

  GraphCreator.prototype.updateWindow = function (svg) {
    var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };

  GraphCreator.prototype.circleDoubleClick = function (d3node, d) {
    var oldtext = d.title; //获得元素之前的内容
    var newtext = prompt("输入节点内容")
    d.title = newtext ? newtext : oldtext;
    this.insertTitleLinebreaks(d3node, d);
    return;
  }; // end of circles mousedblclick

  GraphCreator.prototype.circleClick = function (d3node, d) {
    if (d.name == "branchComponent") {
      d.state = (d.state + 1) % 3;
      this.insertTitleLinebreaks(d3node, d);
      this.updateGraph();
    }
    return;
  }; // end of circles mouseclick

  /**** MAIN ****/

  // warn the user when leaving
  // window.onbeforeunload = function () {
  //   return "Make sure to save your graph locally before leaving :-)";
  // };

  /** MAIN SVG CREATION **/
  var svg = d3.select("div#container").append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  var graph = new GraphCreator(svg, [], []);
  graph.updateGraph();
})(window.d3, window.saveAs, window.Blob);

function generateUUID() {
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
};

function abs(absoluteValue) {

  if (absoluteValue < 0) {
    return absoluteValue * -1;
  } else return absoluteValue
}