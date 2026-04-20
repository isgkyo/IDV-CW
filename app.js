const svg = d3.select("#chart");
const chartWrapper = d3.select("#chart-wrapper");
const tooltip = d3.select("#tooltip");
const legend = d3.select("#legend");

const baseWidth = 1200;
const baseHeight = 680;
const margin = { top: 30, right: 40, bottom: 80, left: 90 };

let width = baseWidth;
let height = baseHeight;
let innerWidth = width - margin.left - margin.right;
let innerHeight = height - margin.top - margin.bottom;

let appData = [];
let olympicYears = [];

const areaColors = {
  Africa: "#4e79a7",
  Asia: "#f28e2b",
  Europe: "#e15759",
  "Middle East": "#76b7b2",
  "North America": "#59a14f",
  Oceania: "#edc948",
  "South America": "#b07aa1",
  None: "#bab0ab",
  Other: "#999999"
};

svg
  .attr("viewBox", `0 0 ${baseWidth} ${baseHeight}`)
  .attr("preserveAspectRatio", "xMinYMin meet");

const g = svg.append("g");

const xAxisGroup = g.append("g").attr("class", "axis");
const yAxisGroup = g.append("g").attr("class", "axis");
const xGridGroup = g.append("g").attr("class", "grid");
const yGridGroup = g.append("g").attr("class", "grid");

g.append("text")
  .attr("class", "x-axis-label")
  .attr("text-anchor", "middle")
  .style("font-size", "14px")
  .text("GDP");

g.append("text")
  .attr("class", "y-axis-label")
  .attr("transform", "rotate(-90)")
  .attr("text-anchor", "middle")
  .style("font-size", "14px")
  .text("Count of Medal Type");

const regressionGroup = g.append("g");
const pointsGroup = g.append("g");
const labelsGroup = g.append("g");

const emptyMessage = g.append("text")
  .attr("class", "empty-message")
  .style("display", "none")
  .text("No data available for the selected filters.");

const yearSlider = d3.select("#yearSlider");
const yearValue = d3.select("#yearValue");

const dropdowns = {
  medal: {
    button: d3.select("#medalButton"),
    panel: d3.select("#medalPanel"),
    search: d3.select("#medalSearch"),
    options: d3.select("#medalOptions"),
    all: d3.select("#medalAll"),
    id: "medalDropdown"
  },
  country: {
    button: d3.select("#countryButton"),
    panel: d3.select("#countryPanel"),
    search: d3.select("#countrySearch"),
    options: d3.select("#countryOptions"),
    all: d3.select("#countryAll"),
    id: "countryDropdown"
  },
  area: {
    button: d3.select("#areaButton"),
    panel: d3.select("#areaPanel"),
    search: d3.select("#areaSearch"),
    options: d3.select("#areaOptions"),
    all: d3.select("#areaAll"),
    id: "areaDropdown"
  }
};

d3.csv("data/gdp_medals.csv", d => ({
  Year: +d.Year,
  Country: d.Country,
  Area: d.Area,
  MedalType: d.MedalType,
  GDP: +d.GDP,
  MedalCount: +d.MedalCount
})).then(rawData => {
  appData = rawData.filter(d =>
    Number.isFinite(d.Year) &&
    d.Country &&
    d.Area &&
    d.MedalType &&
    Number.isFinite(d.GDP) &&
    d.GDP > 0 &&
    Number.isFinite(d.MedalCount) &&
    d.MedalCount >= 0
  );

  olympicYears = [...new Set(appData.map(d => d.Year))].sort((a, b) => a - b);

  setupYearSlider(olympicYears);

  setupMultiDropdown({
    values: [...new Set(appData.map(d => d.MedalType))].sort(),
    ...dropdowns.medal
  });

  setupMultiDropdown({
    values: [...new Set(appData.map(d => d.Country))].sort(),
    ...dropdowns.country
  });

  setupMultiDropdown({
    values: [...new Set(appData.map(d => d.Area))].sort(),
    ...dropdowns.area
  });

  renderLegend([...new Set(appData.map(d => d.Area))].sort());
  updateChartSize();

  yearSlider.on("input", () => {
    yearValue.text(olympicYears[+yearSlider.property("value")]);
    update();
  });

  window.addEventListener("resize", () => {
    updateChartSize();
    update();
  });

  update();
});

function setupYearSlider(years) {
  yearSlider
    .attr("min", 0)
    .attr("max", years.length - 1)
    .attr("step", 1)
    .attr("value", years.length - 1);

  yearValue.text(years[years.length - 1]);
}

function updateChartSize() {
  width = chartWrapper.node().clientWidth || baseWidth;
  height = (baseHeight / baseWidth) * width;
  innerWidth = width - margin.left - margin.right;
  innerHeight = height - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${width} ${height}`);
  g.attr("transform", `translate(${margin.left},${margin.top})`);

  xAxisGroup.attr("transform", `translate(0,${innerHeight})`);
  xGridGroup.attr("transform", `translate(0,${innerHeight})`);

  g.select(".x-axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 55);

  g.select(".y-axis-label")
    .attr("x", -innerHeight / 2)
    .attr("y", -60);

  emptyMessage
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight / 2);
}

function update() {
  if (!appData.length || !olympicYears.length) return;

  const selectedYear = olympicYears[+yearSlider.property("value")];
  const selectedMedals = getSelected(dropdowns.medal.options);
  const selectedCountries = getSelected(dropdowns.country.options);
  const selectedAreas = getSelected(dropdowns.area.options);

  const filtered = appData.filter(d =>
    d.Year === selectedYear &&
    (selectedMedals.length === 0 || selectedMedals.includes(d.MedalType)) &&
    (selectedCountries.length === 0 || selectedCountries.includes(d.Country)) &&
    (selectedAreas.length === 0 || selectedAreas.includes(d.Area))
  );

  const grouped = d3.rollups(
    filtered,
    v => ({
      GDP: d3.mean(v, d => d.GDP),
      MedalCount: d3.sum(v, d => d.MedalCount),
      Area: v[0].Area,
      Year: v[0].Year
    }),
    d => d.Country
  ).map(([Country, values]) => ({ Country, ...values }));

  if (!grouped.length) {
    pointsGroup.selectAll(".dot").remove();
    labelsGroup.selectAll(".point-label").remove();
    regressionGroup.selectAll("*").remove();
    emptyMessage.style("display", "block");
    return;
  }

  emptyMessage.style("display", "none");

  const x = d3.scaleLog()
    .domain([
      Math.max(1, d3.min(grouped, d => d.GDP) * 0.8),
      d3.max(grouped, d => d.GDP) * 1.1
    ])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(grouped, d => d.MedalCount) * 1.1])
    .nice()
    .range([innerHeight, 0]);

  xAxisGroup.transition().duration(500).call(
    d3.axisBottom(x).ticks(12, "~s")
  );

  yAxisGroup.transition().duration(500).call(
    d3.axisLeft(y).ticks(8)
  );

  xGridGroup.transition().duration(500).call(
    d3.axisBottom(x)
      .ticks(12, "~s")
      .tickSize(-innerHeight)
      .tickFormat("")
  );

  yGridGroup.transition().duration(500).call(
    d3.axisLeft(y)
      .ticks(8)
      .tickSize(-innerWidth)
      .tickFormat("")
  );

  const topLabelCountries = grouped
    .slice()
    .sort((a, b) => b.MedalCount - a.MedalCount)
    .slice(0, 12)
    .map(d => d.Country);

  const circles = pointsGroup.selectAll(".dot")
    .data(grouped, d => d.Country);

  circles.exit()
    .transition()
    .duration(300)
    .attr("r", 0)
    .remove();

  circles.transition()
    .duration(500)
    .attr("cx", d => x(d.GDP))
    .attr("cy", d => y(d.MedalCount))
    .attr("r", 6)
    .attr("fill", d => areaColors[d.Area] || areaColors.Other);

  circles.enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", d => x(d.GDP))
    .attr("cy", d => y(d.MedalCount))
    .attr("r", 0)
    .attr("fill", d => areaColors[d.Area] || areaColors.Other)
    .on("mouseover", function(event, d) {
      pointsGroup.selectAll(".dot").classed("dimmed", true);

      d3.select(this)
        .classed("dimmed", false)
        .classed("active", true)
        .attr("r", 8);

      tooltip
        .style("display", "block")
        .html(`
          <strong>${d.Country}</strong><br>
          Year: ${d.Year}<br>
          Area: ${d.Area}<br>
          Medal Type Filter: ${selectedMedals.length ? selectedMedals.join(", ") : "All"}<br>
          Area Filter: ${selectedAreas.length ? selectedAreas.join(", ") : "All"}<br>
          GDP: ${formatGDP(d.GDP)}<br>
          Medal Count: ${d.MedalCount}
        `);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      pointsGroup.selectAll(".dot").classed("dimmed", false).classed("active", false);
      d3.select(this).attr("r", 6);
      tooltip.style("display", "none");
    })
    .transition()
    .duration(500)
    .attr("r", 6);

  const labels = labelsGroup.selectAll(".point-label")
    .data(grouped.filter(d => topLabelCountries.includes(d.Country)), d => d.Country);

  labels.exit().remove();

  labels.transition()
    .duration(500)
    .attr("x", d => x(d.GDP) + 8)
    .attr("y", d => y(d.MedalCount) - 8)
    .text(d => d.Country);

  labels.enter()
    .append("text")
    .attr("class", "point-label")
    .attr("x", d => x(d.GDP) + 8)
    .attr("y", d => y(d.MedalCount) - 8)
    .text(d => d.Country);

  drawRegressionLine(grouped, x, y);
}

function setupMultiDropdown({ values, button, panel, search, options, all, id }) {
  const rows = options.selectAll(".dropdown-option.item")
    .data(values)
    .enter()
    .append("label")
    .attr("class", "dropdown-option item")
    .style("display", "flex");

  rows.append("input")
    .attr("type", "checkbox")
    .attr("value", d => d)
    .property("checked", true)
    .on("change", () => {
      syncAllState(options, all);
      updateButtonText(button, options);
      yearSlider.dispatch("input");
    });

  rows.append("span").text(d => d);

  button.on("click", () => {
    const isOpen = panel.classed("open");
    closeAllDropdowns();
    panel.classed("open", !isOpen);
    if (!isOpen) search.node().focus();
  });

  all.on("change", function() {
    options.selectAll("input[type='checkbox']").property("checked", this.checked);
    updateButtonText(button, options);
    yearSlider.dispatch("input");
  });

  search.on("input", function() {
    const keyword = this.value.trim().toLowerCase();
    options.selectAll(".item")
      .style("display", d => d.toLowerCase().includes(keyword) ? "flex" : "none");
  });

  d3.select(document).on(`click.${id}`, event => {
    const dropdownNode = document.getElementById(id);
    if (!dropdownNode.contains(event.target)) {
      panel.classed("open", false);
    }
  });

  updateButtonText(button, options);
}

function closeAllDropdowns() {
  d3.selectAll(".dropdown-panel").classed("open", false);
}

function getSelected(optionsContainer) {
  return optionsContainer.selectAll("input[type='checkbox']")
    .nodes()
    .filter(node => node.checked)
    .map(node => node.value);
}

function syncAllState(optionsContainer, allCheckbox) {
  const nodes = optionsContainer.selectAll("input[type='checkbox']").nodes();
  allCheckbox.property("checked", nodes.every(node => node.checked));
}

function updateButtonText(button, optionsContainer) {
  const selected = getSelected(optionsContainer);
  const total = optionsContainer.selectAll("input[type='checkbox']").size();

  if (selected.length === total) button.text("All");
  else if (selected.length === 0) button.text("None");
  else if (selected.length === 1) button.text(selected[0]);
  else button.text(`${selected.length} selected`);
}

function renderLegend(areas) {
  legend.selectAll("*").remove();

  const items = legend.selectAll(".legend-item")
    .data(areas)
    .enter()
    .append("div")
    .attr("class", "legend-item");

  items.append("div")
    .attr("class", "legend-color")
    .style("background-color", d => areaColors[d] || areaColors.Other);

  items.append("div").text(d => d);
}

function drawRegressionLine(data, xScale, yScale) {
  regressionGroup.selectAll("*").remove();
  if (data.length < 2) return;

  const xValues = data.map(d => Math.log10(d.GDP));
  const yValues = data.map(d => d.MedalCount);
  const xMean = d3.mean(xValues);
  const yMean = d3.mean(yValues);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < xValues.length; i++) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += (xValues[i] - xMean) ** 2;
  }

  if (denominator === 0) return;

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  const [x1, x2] = xScale.domain();
  const y1 = intercept + slope * Math.log10(x1);
  const y2 = intercept + slope * Math.log10(x2);

  regressionGroup.append("line")
    .attr("x1", xScale(x1))
    .attr("y1", yScale(y1))
    .attr("x2", xScale(x2))
    .attr("y2", yScale(y2))
    .attr("stroke", "#777")
    .attr("stroke-width", 2.2);
}

function formatGDP(value) {
  return d3.format("$.3s")(value).replace("G", "B");
}
