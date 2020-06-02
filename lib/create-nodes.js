"use strict";

var _ = require("./lodash");
var addLabel = require("./label/add-label");
var util = require("./util");
var d3 = require("./d3");

module.exports = createNodes;

function createNodes(selection, g, shapes) {
  var simpleNodes = g.nodes().filter(function(v) { return !util.isSubgraph(g, v); });
  var svgNodes = selection.selectAll("g.node")
    .data(simpleNodes, function(v) { return v; })
    .classed("update", true);

  svgNodes.exit().remove();

  svgNodes.enter().append("g")
    .attr("class", "node")
    .style("opacity", 0);

  // create queue for batch processing
  // batch reading from then writing to DOM for increased performance
  var itemQueue = [];
  var labelQueue = [];

  svgNodes = selection.selectAll("g.node"); 

  svgNodes.each(function(v) {
    var node = g.node(v);
    var thisGroup = d3.select(this);
    util.applyClass(thisGroup, node["class"],
      (thisGroup.classed("update") ? "update " : "") + "node");

    thisGroup.select("g.label").remove();
    var labelGroup = thisGroup.append("g").attr("class", "label");
    var label = addLabel.createLabel(labelGroup, node);
    var labelDom = label.labelSvg;

    labelQueue.push(label);

    // add to queue for further processing
    itemQueue.push({self: this, node: node, thisGroup: thisGroup, labelGroup: labelGroup, labelDom: labelDom});
  });

  addLabel.styleLabels(labelQueue);

  // get bounding box for each label
  itemQueue.forEach(function(item) {
    item.bbox = _.pick(item.labelDom.node().getBBox(), "width", "height");
  });

  // apply styles with bbox info
  itemQueue.forEach(function(item) {
    var node = item.node,
      thisGroup = item.thisGroup,
      labelGroup = item.labelGroup,
      self = item.self,
      bbox = item.bbox;
    var shape = shapes[node.shape];
    node.elem = self;

    if (node.id) { thisGroup.attr("id", node.id); }
    if (node.labelId) { labelGroup.attr("id", node.labelId); }

    if (_.has(node, "width")) { bbox.width = node.width; }
    if (_.has(node, "height")) { bbox.height = node.height; }

    bbox.width += node.paddingLeft + node.paddingRight;
    bbox.height += node.paddingTop + node.paddingBottom;
    labelGroup.attr("transform", "translate(" +
      ((node.paddingLeft - node.paddingRight) / 2) + "," +
      ((node.paddingTop - node.paddingBottom) / 2) + ")");

    var root = d3.select(self);
    root.select(".label-container").remove();
    item.shapeSvg = shape(root, bbox, node);
    item.shapeSvg.classed("label-container", true);
  });

  itemQueue.forEach(function(item) {
    util.applyStyle(item.shapeSvg, item.node.style);
  });

  itemQueue.forEach(function(item) {
    item.shapeBBox = item.shapeSvg.node().getBBox();
  });

  itemQueue.forEach(function(item) {
    item.node.width = item.shapeBBox.width;
    item.node.height = item.shapeBBox.height;
  });

  var exitSelection;

  if (svgNodes.exit) {
    exitSelection = svgNodes.exit();
  } else {
    exitSelection = svgNodes.selectAll(null); // empty selection
  }

  util.applyTransition(exitSelection, g)
    .style("opacity", 0)
    .remove();

  return svgNodes;
}
