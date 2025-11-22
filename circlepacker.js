
const uploadArea = document.getElementById('upload-area');
const renderButton = document.getElementById('render-button');
let data = null;
let packedData = null;

renderButton.addEventListener('click', renderChart);

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  uploadArea.addEventListener(eventName, preventDefaults, false)
});
  
function preventDefaults (e) {
  e.preventDefault()
  e.stopPropagation()
}

['dragenter', 'dragover'].forEach(eventName => {
  uploadArea.addEventListener(eventName, highlight, false)
});
  
['dragleave', 'drop'].forEach(eventName => {
  uploadArea.addEventListener(eventName, unhighlight, false)
});
  
function highlight(e) {
  uploadArea.classList.add('highlight')
}
  
function unhighlight(e) {
  uploadArea.classList.remove('highlight')
}

uploadArea.addEventListener('drop', handleUploadDrop);

function handleUploadDrop(event) {
  let files = event.dataTransfer.files;
  if (files.length != 1) {
    alert("Just one file at a time, please.");
  } else {
    loadFile(files[0]);
  }
}

function loadFile(file) {
  Papa.parse(file, {
    header: true,
    complete: function(results) {
      data = results.data;
      showMenus(results.meta.fields);
    }
  });
}

function showMenus(options) {
  const menu = document.getElementById("chart-menu");
  menu.classList.toggle('visible', true);

  ['first-level', 'second-level', 'third-level', 'label-column', 'color-column'].forEach(menuItem => {
    const select = document.getElementById(menuItem); 
    emptySelector(select);
    addOptionsToSelector(select, options);
  })
}

function emptySelector(select) {
  for (var i = select.length - 1; i >= 0; i--) {
    select.remove(i);
  }
}

function addOptionsToSelector(select, options) {
  select.add(new Option(""), "");
  for (const o of options) {
    const newOption = new Option(o, o);
    select.add(newOption);
  }
}

function renderChart() {
  const leafColumn = document.getElementById('label-column').value;
  const colorColumn = document.getElementById('color-column').value;

  // Validate required fields
  if (!leafColumn || !colorColumn) {
    alert('Please select both a Label column and a Color column.');
    return;
  }

  const groupingFunctions = [];

  ['first-level', 'second-level', 'third-level'].forEach(menu => {
    const columnName = document.getElementById(menu).value;
    groupingFunctions.push(d => d[columnName]);
  }) 

  packedData = {name: 'pack', children: []};
  const distinctColorEntries = [];

  for (const row of data) {
    packData(packedData, groupingFunctions, row);
    distinctColorEntries[row[colorColumn]] = null;
  }

  const distinctCount = Object.keys(distinctColorEntries).length;
  let distinctIndex = 0;
  for (const entry in distinctColorEntries) {
    distinctColorEntries[entry] = d3.interpolateRainbow(distinctIndex++ / distinctCount);
  }

  convertChildrenToArrays(packedData);

  // Calculate responsive size based on container width
  const chartArea = document.getElementById("chart-area");
  const container = chartArea.closest('.container');
  const containerWidth = container ? container.clientWidth : (chartArea.clientWidth || 1152);
  const size = Math.min(containerWidth, window.innerHeight - 100);

  let circleChart = Pack(packedData, {
    value: d => 1000, // size of each node (file); null for internal nodes (folders)
    label: (d, n) => d.children ? d.name : d[leafColumn],
    title: (d, n) => d.children ? d.name : d[leafColumn] +  " - " + d[colorColumn],
    fillFunc: (d) => distinctColorEntries[d[colorColumn]],
    width: size,
    height: size
  });

  chartArea.replaceChildren(circleChart);
}

// Re-render on window resize (debounced)
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (packedData && packedData.children && packedData.children.length > 0) {
      renderChart();
    }
  }, 250);
});

function packData(node, groupingFunctions, row) {
  if (groupingFunctions.length > 0 && groupingFunctions[0]) {
    const name = groupingFunctions[0](row);
    let child = node.children[name];
    if (!child) {
      child = {
        name: name,
        children: []
      }
      node.children[name] = child;
    }

    packData(child, groupingFunctions.slice(1), row);

  } else {
    node.children.push(row);
  }
}

function convertChildrenToArrays(parent) {
  if (parent.children) {
    parent.children = Object.values(parent.children);

    for (const child of parent.children) {
      convertChildrenToArrays(child);
    }
  }
}

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/pack
// Modified to add zoomable functionality
function Pack(data, { // data is either tabular (array of objects) or hierarchy (nested objects)
  path, // as an alternative to id and parentId, returns an array identifier, imputing internal nodes
  id = Array.isArray(data) ? d => d.id : null, // if tabular data, given a d in data, returns a unique identifier (string)
  parentId = Array.isArray(data) ? d => d.parentId : null, // if tabular data, given a node d, returns its parent's identifier
  children, // if hierarchical data, given a d in data, returns its children
  value, // given a node d, returns a quantitative value (for area encoding; null for count)
  sort = (a, b) => d3.descending(a.value, b.value), // how to sort nodes prior to layout
  label, // given a leaf node d, returns the display name
  title, // given a node d, returns its hover text
  width = 640, // outer width, in pixels
  height = 400, // outer height, in pixels
  margin = 1, // shorthand for margins
  marginTop = margin, // top margin, in pixels
  marginRight = margin, // right margin, in pixels
  marginBottom = margin, // bottom margin, in pixels
  marginLeft = margin, // left margin, in pixels
  padding = 3, // separation between circles
  fill = "#ddd", // fill for leaf circles
  fillFunc, // If provided, overrides fill with function call
  fillOpacity, // fill opacity for leaf circles
  stroke = "#bbb", // stroke for internal circles
  strokeWidth, // stroke width for internal circles
  strokeOpacity, // stroke opacity for internal circles
} = {}) {

  // If id and parentId options are specified, or the path option, use d3.stratify
  // to convert tabular data to a hierarchy; otherwise we assume that the data is
  // specified as an object {children} with nested objects (a.k.a. the "flare.json"
  // format), and use d3.hierarchy.
  const root = path != null ? d3.stratify().path(path)(data)
      : id != null || parentId != null ? d3.stratify().id(id).parentId(parentId)(data)
      : d3.hierarchy(data, children);

  // Compute the values of internal nodes by aggregating from the leaves.
  value == null ? root.count() : root.sum(d => Math.max(0, value(d)));

  // Compute labels and titles.
  const descendants = root.descendants();
  const leaves = descendants.filter(d => !d.children);
  leaves.forEach((d, i) => d.index = i);
  const L = label == null ? null : leaves.map(d => label(d.data, d));
  const T = title == null ? null : descendants.map(d => title(d.data, d));

  // Sort the leaves (typically by descending value for a pleasing layout).
  if (sort != null) root.sort(sort);

  // Compute the layout.
  d3.pack()
      .size([width - marginLeft - marginRight, height - marginTop - marginBottom])
      .padding(padding)
    (root);

  // Zoom state
  let focus = root;
  let view;

  const svg = d3.create("svg")
      .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-width: 100%; height: auto; display: block; cursor: pointer;")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "middle")
      .on("click", (event) => zoom(event, root));

  const node = svg.append("g")
    .selectAll("circle")
    .data(descendants)
    .join("circle")
      .attr("fill", d => d.children ? "#fff" : fillFunc ? fillFunc(d.data) : fill)
      .attr("fill-opacity", d => d.children ? null : fillOpacity)
      .attr("stroke", d => d.children ? stroke : null)
      .attr("stroke-width", d => d.children ? strokeWidth : null)
      .attr("stroke-opacity", d => d.children ? strokeOpacity : null)
      .attr("pointer-events", d => !d.children ? "none" : null)
      .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
      .on("mouseout", function(event, d) { d3.select(this).attr("stroke", d.children ? stroke : null); })
      .on("click", (event, d) => focus !== d && (zoom(event, d), event.stopPropagation()));

  if (T) node.append("title").text((d, i) => T[i]);

  // Create arc paths for parent circle labels (9 o'clock to 3 o'clock)
  const uid = `O-${Math.random().toString(16).slice(2)}`;

  const parentNodes = svg.append("g")
      .attr("pointer-events", "none")
    .selectAll("g")
    .data(descendants.filter(d => d.children && d.depth > 0))
    .join("g");

  // Create arc path for each parent circle
  parentNodes.append("path")
    .attr("id", d => `${uid}-path-${d.data.name}-${d.depth}`)
    .attr("fill", "none")
    .attr("d", d => {
      const r = d.r;
      // Arc from 9 o'clock (-180°) to 3 o'clock (0°) along top
      const startAngle = Math.PI; // 9 o'clock
      const endAngle = 0; // 3 o'clock
      const x1 = d.x + r * Math.cos(startAngle);
      const y1 = d.y + r * Math.sin(startAngle);
      const x2 = d.x + r * Math.cos(endAngle);
      const y2 = d.y + r * Math.sin(endAngle);
      return `M ${x1},${y1} A ${r},${r} 0 0,0 ${x2},${y2}`;
    });

  // White background stroke for readability
  parentNodes.append("text")
    .style("font", "10px Helvetica, Arial, sans-serif")
    .style("letter-spacing", "-0.5px")
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-width", 3)
    .attr("stroke-linejoin", "round")
    .style("fill-opacity", d => d.parent === root ? 1 : 0)
    .style("display", d => d.parent === root ? "inline" : "none")
    .append("textPath")
      .attr("href", d => `#${uid}-path-${d.data.name}-${d.depth}`)
      .attr("startOffset", "50%")
      .attr("text-anchor", "middle")
      .text(d => d.data.name);

  // Actual text label
  parentNodes.append("text")
    .style("font", "10px Helvetica, Arial, sans-serif")
    .style("letter-spacing", "-0.5px")
    .attr("fill", "#333")
    .style("fill-opacity", d => d.parent === root ? 1 : 0)
    .style("display", d => d.parent === root ? "inline" : "none")
    .append("textPath")
      .attr("href", d => `#${uid}-path-${d.data.name}-${d.depth}`)
      .attr("startOffset", "50%")
      .attr("text-anchor", "middle")
      .text(d => d.data.name);

  // Labels for leaf nodes (centered in circle)
  const labelGroup = svg.append("g")
      .style("font", "10px Helvetica, Arial, sans-serif")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
    .selectAll("text")
    .data(descendants.filter(d => !d.children))
    .join("text")
      .style("fill-opacity", d => d.parent === root ? 1 : 0)
      .style("display", d => d.parent === root ? "inline" : "none")
      .text(d => L && d.index !== undefined ? L[d.index] : "");

  zoomTo([root.x, root.y, root.r * 2]);

  function zoomTo(v) {
    const k = width / v[2];
    view = v;

    // Update leaf labels
    labelGroup.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
    labelGroup.attr("font-size", d => Math.min(12, d.r * k / 3) + "px");

    // Update circles
    node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
    node.attr("r", d => d.r * k);

    // Update parent node arc paths and labels
    parentNodes.select("path").attr("d", d => {
      const r = d.r * k;
      const cx = (d.x - v[0]) * k;
      const cy = (d.y - v[1]) * k;
      const startAngle = Math.PI;
      const endAngle = 0;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      return `M ${x1},${y1} A ${r},${r} 0 0,0 ${x2},${y2}`;
    });

    // Scale font size for parent labels
    parentNodes.selectAll("text")
      .style("font-size", d => Math.min(14, Math.max(8, d.r * k / 4)) + "px");
  }

  function zoom(event, d) {
    focus = d;

    const transition = svg.transition()
        .duration(event.altKey ? 7500 : 750)
        .tween("zoom", () => {
          const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
          return t => zoomTo(i(t));
        });

    // Transition leaf labels
    labelGroup
      .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
      .transition(transition)
        .style("fill-opacity", d => d.parent === focus ? 1 : 0)
        .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
        .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });

    // Transition parent labels
    parentNodes.selectAll("text")
      .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
      .transition(transition)
        .style("fill-opacity", d => d.parent === focus ? 1 : 0)
        .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
        .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });
  }

  return svg.node();
}