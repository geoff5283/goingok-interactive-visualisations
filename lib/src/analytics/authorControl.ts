import d3 from "d3";
import { ChartNetwork, ChartTimeNetwork } from "charts/charts.js";
import { IHelp, Help } from "charts/help.js";
import { IAuthorControlInteractions, AuthorControlInteractions, TooltipValues } from "charts/interactions.js";
import { IRelfectionAuthorAnalytics, ITags, INetworkData, IReflectionAuthor, ILinks } from "data/data.js";

export interface IAuthorControlCharts {
    help: IHelp;
    interactions: IAuthorControlInteractions;
    preloadTags(entries: IRelfectionAuthorAnalytics[], enable?: boolean): ITags[];
    processNetworkData(chart: ChartNetwork, entries: IRelfectionAuthorAnalytics[]): INetworkData;
    processSimulation(chart: ChartNetwork, data: INetworkData): void;
    processTimelineSimulation(chart: ChartTimeNetwork, centerX: number, centerY: number, nodes: ITags[]): void;
    renderTimeline(chart: ChartTimeNetwork, data: IReflectionAuthor[]): ChartTimeNetwork;
    renderNetwork(chart: ChartNetwork, data: INetworkData): ChartNetwork;
    renderReflections(data: IReflectionAuthor[]): void;
}

export class AuthorControlCharts implements IAuthorControlCharts {
    help = new Help();
    interactions = new AuthorControlInteractions();

    preloadTags(entries: IRelfectionAuthorAnalytics[], enable: boolean = false): ITags[] {
        let allTags = [] as ITags[];
        entries.forEach(c => {
            allTags = allTags.concat(c.tags.map(d => { { return { "tag": d.tag, "colour": d.colour } as ITags}}))
        })
        let groupTags = Array.from(d3.rollup(allTags, d => d.map(r => r.colour)[0], d => d.tag), ([tag, colour]) => ({tag, colour}));
        let uniqueTags = groupTags.map(d => { return {"tag": d.tag, "colour": d.colour, "selected": true } }) as ITags[]

        d3.select("#tags").selectAll("li")
            .data(uniqueTags)
            .enter()
            .append("li")
            .attr("class", "mx-3")
            .append("div")
            .attr("class", "input-group")
            .call(div => div.append("input")
                .attr("type", "text")
                .attr("class", "form-control tag-row")
                .attr("value", d => d.tag)
                .property("disabled", true))
            .call(div => div.append("div")
                .attr("class", "input-group-append")
                .append("div")
                .attr("class", "input-group-text tag-row")
                .append("input")
                .attr("id", d => `colour-${d.tag}`)
                .attr("type", "color")
                .attr("value", d => d.colour)
                .property("disabled", !enable));
        
        return uniqueTags
    }

    processNetworkData(chart: ChartNetwork, entries: IRelfectionAuthorAnalytics[]): INetworkData {
        let networkData = { "nodes": [] as ITags[], "links": [] as ILinks<ITags>[] } as INetworkData;
        entries.forEach(c => {
            let tags = c.tags.map(d => { return {...d} });
            networkData.nodes = networkData.nodes.concat(tags);
            let refTag = { "tag": "ref", "phrase": c.timestamp.toDateString(), "colour": "#f2f2f2", "fx": chart.x.scale(c.timestamp) } as ITags;
            networkData.nodes.push(refTag);
            c.matrix.forEach((r, i) => {
                for (var x = 0; x < r.length; x++) {
                    if (r[x] !== 0) networkData.links.push({ "source": tags[i], "target": tags[x], "weight": r[x] })
                }
                networkData.links.push({ "source": refTag, "target": tags[i], "weight": 1, "isReflection": true });
            })
        })

        return networkData;
    }

    processSimulation(chart: ChartNetwork, data: INetworkData): d3.Simulation<ITags, undefined> {
        return d3.forceSimulation<ITags, undefined>(data.nodes)
            .force("link", d3.forceLink()
                .id(d => d.index)
                .distance(100)
                .links(data.links))
            .force("charge", d3.forceManyBody().strength(-25))
            .force("collide", d3.forceCollide().radius(30).iterations(5))
            .force("center", d3.forceCenter((chart.width -chart.padding.yAxis - chart.padding.right - 10) / 2, (chart.height - chart.padding.top - chart.padding.xAxis + 5) / 2));
    }

    processTimelineSimulation(chart: ChartTimeNetwork, centerX: number, centerY: number, nodes: ITags[]): void {
        let simulation = d3.forceSimulation<ITags, undefined>(nodes)
            .force("collide", d3.forceCollide().radius(10))
            .force("forceRadial", d3.forceRadial(0, 0).radius(15));
        if (centerY < 20) {
            simulation.force("forceY", d3.forceY(20).strength(0.25))
        }
        if (chart.height - chart.padding.top - chart.padding.xAxis - 20 < centerY) {
            simulation.force("forceY", d3.forceY(-20).strength(0.25))
        }
        if (centerX < 20) {
            simulation.force("forceX", d3.forceX(20).strength(0.25))
        }
        if (chart.width - chart.padding.yAxis - chart.padding.right - 20 < centerX) {
            simulation.force("forceX", d3.forceX(-20).strength(0.25))
        }
        return simulation.tick(300);
    }

    renderTimeline(chart: ChartTimeNetwork, data: IRelfectionAuthorAnalytics[]): ChartTimeNetwork {
        const _this = this;

        const hardLine = d3.line<IRelfectionAuthorAnalytics>()
            .x(d => chart.x.scale(d.timestamp))
            .y(d => chart.y.scale(d.point))
            .curve(d3.curveMonotoneX);

        if (chart.elements.contentContainer.select(".hardline").empty()) {
            chart.elements.contentContainer.append("path")
                .datum(d3.sort(data, d => d.timestamp))
                .attr("class", "hardline")
                .attr("d", d => hardLine(d));
        }
        
        chart.elements.contentContainer.selectAll(".circle-tag-container")
            .data(data)
            .join(
                enter => enter.append("g")
                    .attr("class", "circle-tag-container")
                    .call(enter => enter.append("circle")
                        .attr("class", "circle")
                        .attr("r", 5)
                        .style("fill", "#999999")
                        .style("stroke", "#999999"))
                    .call(enter => renderTimelineNetwork(enter))
                    .call(enter => enter.transition()
                        .duration(750)
                        .attr("transform", d => `translate (${chart.x.scale(d.timestamp)}, ${chart.y.scale(d.point)})`)),
                update => update.call(update => update.transition()
                    .duration(750)
                    .attr("cx", d => chart.x.scale(d.timestamp))
                    .attr("cy", d => chart.y.scale(d.point))
                    .style("fill", "#999999")
                    .style("stroke", "#999999"))
                    .call(update => renderTimelineNetwork(update)),
                exit => exit.remove()
            );
        
        function renderTimelineNetwork(enter: d3.Selection<SVGGElement | d3.BaseType, IRelfectionAuthorAnalytics, SVGGElement, unknown>) {
            enter.selectAll(".circle-tag")
                .data(d => d.tags)
                .join(
                    enter => enter.append("circle")
                        .attr("class", "circle-tag")
                        .attr("cx", d => d.x)
                        .attr("cy", d => d.y)
                        .attr("r", 5)
                        .style("fill", d => d.colour)
                        .style("stroke", d => d.colour),
                    update => update.call(update => update.transition()
                        .duration(750)
                        .attr("cx", d => d.x)
                        .attr("cy", d => d.y)
                        .style("fill", d => d.colour)
                        .style("stroke", d => d.colour)),
                    exit => exit.remove()
                )
               
        }
        
        chart.elements.content = chart.elements.contentContainer.selectAll(".circle");

        //Enable tooltip       
        _this.interactions.tooltip.enableTooltip(chart, onMouseover, onMouseout);
        function onMouseover(e: Event, d: IRelfectionAuthorAnalytics) {
            if (d3.select(this).attr("class").includes("clicked")) {
                return;
            }
            _this.interactions.tooltip.appendTooltipContainer(chart);
            let tooltipValues = [new TooltipValues("Point", d.point)];
            let tags = Array.from(d3.rollup(d.tags, d => d.length, d  => d.tag), ([tag, total]) => ({tag, total}));
            tags.forEach(c => {
                tooltipValues.push(new TooltipValues(c.tag, c.total));
            })
            let tooltipBox = _this.interactions.tooltip.appendTooltipText(chart, d.timestamp.toDateString(), tooltipValues);
            _this.interactions.tooltip.positionTooltipContainer(chart, xTooltip(d.timestamp, tooltipBox), yTooltip(d.point, tooltipBox));

            function xTooltip(x: Date, tooltipBox: d3.Selection<SVGRectElement, unknown, HTMLElement, any>) {
                let xTooltip = chart.x.scale(x);
                if (chart.width - chart.padding.yAxis < xTooltip + tooltipBox.node().getBBox().width) {
                    return xTooltip - tooltipBox.node().getBBox().width;
                }
                return xTooltip
            };

            function yTooltip(y: number, tooltipBox: d3.Selection<SVGRectElement, unknown, HTMLElement, any>) {
                var yTooltip = chart.y.scale(y) - tooltipBox.node().getBBox().height - 10;
                if (yTooltip < 0) {
                    return yTooltip + tooltipBox.node().getBBox().height + 20;
                }
                return yTooltip;
            };

            _this.interactions.tooltip.appendLine(chart, 0, chart.y.scale(d.point), chart.x.scale(d.timestamp), chart.y.scale(d.point), "#999999");
            _this.interactions.tooltip.appendLine(chart, chart.x.scale(d.timestamp), chart.y.scale(0), chart.x.scale(d.timestamp), chart.y.scale(d.point), "#999999");
        }
        function onMouseout() {
            chart.elements.svg.select(".tooltip-container").transition()
                .style("opacity", 0);
            _this.interactions.tooltip.removeTooltip(chart);
        }

        return chart;
    }

    renderNetwork(chart: ChartNetwork, data: INetworkData): ChartNetwork {
        const _this = this;

        d3.select(`#${chart.id} .card-subtitle`)
            .html(data.nodes.filter(d => d.tag === "ref").length == 1 ? `Filtering by <span class="badge badge-pill badge-info">${chart.x.scale.invert(data.nodes.find(d => d.tag === "ref").fx).toDateString()} <i class="fas fa-window-close"></i></span>`:
                "");

        let links = chart.elements.contentContainer.selectAll(".network-link")
            .data(data.links)
            .join(
                enter => enter.append("line")
                    .attr("class", "network-link")
                    .classed("reflection-link", d => d.isReflection)
                    .attr("x1", chart.width / 2)
                    .attr("y1", chart.height / 2)
                    .attr("x2", chart.width / 2)
                    .attr("y2", chart.height / 2)
                    .call(enter => enter.transition()
                        .duration(750)               
                        .attr("x1", d => (d.source as ITags).x)
                        .attr("y1", d => (d.source as ITags).y)
                        .attr("x2", d => (d.target as ITags).x)
                        .attr("y2", d => (d.target as ITags).y)),
                update => update.call(update => update.classed("reflection-link", d => d.isReflection)
                    .transition()
                    .duration(750)               
                    .attr("x1", d => (d.source as ITags).x)
                    .attr("y1", d => (d.source as ITags).y)
                    .attr("x2", d => (d.target as ITags).x)
                    .attr("y2", d => (d.target as ITags).y)),
                exit => exit.remove()
            );
        
        let nodes = chart.elements.contentContainer.selectAll(".network-node-group")
            .data(data.nodes)
            .join(
                enter => enter.append("g")
                    .attr("class", "network-node-group")
                    .attr("transform", `translate(${chart.width / 2}, ${chart.height / 2})`)
                    .call(enter => enter.append("rect")
                        .attr("class", "network-node")
                        .style("fill", d => d.colour)
                        .style("stroke", d => d.colour))
                    .call(enter => enter.append("text")
                        .attr("id", d => `text-${d.index}`)
                        .attr("class", "network-text"))
                    .call(enter => enter.select("rect")
                        .attr("x", -5)
                        .attr("y", -5)
                        .attr("width", 10)
                        .attr("height", 10))
                    .call(enter => enter.transition()
                        .duration(750)
                        .attr("transform", d => `translate(${d.x}, ${d.y})`)),
                update => update.call(update => update.transition()
                    .duration(750)
                    .attr("transform", d => `translate(${d.x}, ${d.y})`))
                    .call(update => update.select("rect")
                        .style("fill", d => d.colour)
                        .style("stroke", d => d.colour))
                    .call(update => update.select("text")
                        .attr("id", d => `text-${d.index}`)),
                exit => exit.remove()
            );
        
        chart.elements.content = chart.elements.contentContainer.selectAll(".network-node-group");

        chart.simulation.on("tick", ticked);

        function ticked() {
            links.attr("x1", d => (d.source as ITags).x)
            .attr("y1", d => (d.source as ITags).y)
            .attr("x2", d => (d.target as ITags).x)
            .attr("y2", d => (d.target as ITags).y);

            nodes.attr("transform", (d: ITags) => `translate(${d.x}, ${d.y})`);
        }

        //Enable tooltip       
        _this.interactions.tooltip.enableTooltip(chart, onMouseover, onMouseout);
        function onMouseover(e: Event, d: ITags) {
            if (d3.select(this).attr("class").includes("clicked")) {
                return;
            }

            let links = data.links.filter(d => d.source === d3.select<SVGGElement, ITags>(this).datum()).map(d => d.target);
            links = links.concat(data.links.filter(d => d.target === d3.select<SVGGElement, ITags>(this).datum()).map(d => d.source));
            links.push(d3.select<SVGGElement, ITags>(this).datum());

            d3.selectAll<SVGGElement, ITags>(".network-node-group")
                .filter(d => links.includes(d))
                .call(enter => enter.select("text")
                    .text(d => d.phrase)
                    .style("opacity", 0)
                    .transition()
                    .duration(500)
                    .style("opacity", "1"))
                .call(enter => enter.select(".network-node")
                    .transition()
                    .duration(500)
                    .attr("x", d => -(enter.select<SVGTextElement>(`#text-${d.index}`).node().getBoundingClientRect().width + 10) / 2)
                    .attr("y", d => -(enter.select<SVGTextElement>(`#text-${d.index}`).node().getBoundingClientRect().height + 5) / 2)
                    .attr("width", d => enter.select<SVGTextElement>(`#text-${d.index}`).node().getBoundingClientRect().width + 10)
                    .attr("height", d => enter.select<SVGTextElement>(`#text-${d.index}`).node().getBoundingClientRect().height + 5))
        }

        function onMouseout() {
            let links = data.links.filter(d => d.source === d3.select<SVGGElement, ITags>(this).datum()).map(d => d.target);
            links = links.concat(data.links.filter(d => d.target === d3.select<SVGGElement, ITags>(this).datum()).map(d => d.source));
            links.push(d3.select<SVGGElement, ITags>(this).datum());

            d3.selectAll<SVGGElement, ITags>(".network-node-group")
                .filter(d => links.includes(d))
                .call(enter => enter.select("text")
                    .text(null)
                    .style("opacity", 0)
                    .transition()
                    .duration(500)
                    .style("opacity", "1"))
                .call(enter => enter.select(".network-node")
                    .transition()
                    .duration(500)
                    .attr("x", -5)
                    .attr("y", -5)
                    .attr("width", 10)
                    .attr("height", 10))
            
            _this.interactions.tooltip.removeTooltip(chart);
        }

        //Enable zoom
        _this.interactions.zoom.enableZoom(chart, zoomed);
        function zoomed(e: d3.D3ZoomEvent<SVGRectElement, unknown>) {
            let newChartRange = [0, chart.width - chart.padding.yAxis - chart.padding.right].map(d => e.transform.applyX(d));
            chart.x.scale.rangeRound(newChartRange);

            chart.elements.contentContainer.selectAll<SVGLineElement, any>(".network-link")
                .attr("x1", d => e.transform.applyX(d.source.x))
                .attr("x2", d => e.transform.applyX(d.target.x));

            chart.elements.contentContainer.selectAll<SVGGElement, ITags>(".network-node-group")
                .attr("transform", (d, i, g) => `translate(${e.transform.applyX(d.x)}, ${d.y})`);

            chart.x.axis.ticks(newChartRange[1] / 75);
            chart.elements.xAxis.call(chart.x.axis);
            _this.help.removeHelp(chart);
        }

        return chart;
    }

    renderReflections(data: IRelfectionAuthorAnalytics[]) {
        const _this = this
        
        d3.select("#reflections .card-subtitle")
        .html(data.length == 1 ? `Filtering by <span class="badge badge-pill badge-info">${data[0].timestamp.toDateString()} <i class="fas fa-window-close"></i></span>`:
            "");

        d3.select<HTMLDivElement, Date>("#reflections .reflections-tab")
            .selectAll(".reflection")
            .data(data)
            .join(
                enter => enter.append("div")
                .attr("class", "reflection")
                .call(div => div.append("p")
                    .attr("class", "reflection-text")
                    .html(d => _this.processReflectionsText(d))),
                update => update.select<HTMLParagraphElement>("p")
                    .html(d => _this.processReflectionsText(d)),
                exit => exit.remove()
            )
           
    }

    processReflectionsText(data: IRelfectionAuthorAnalytics): string {
        let html = `<i>${data.timestamp.toDateString()} | Point: ${data.point}</i><br>`;
        for (var i = 0; i < data.text.length; i++) {
            const isOpenTag = data.tags.find(c => c.start_index === i);
            const isCloseTag = data.tags.find(c => c.end_index === i);
            if (isOpenTag !== undefined) {
                html += `<span class="badge badge-pill" style="background-color: ${isOpenTag.colour}">${data.text[i]}`
            } else if (isCloseTag !== undefined) {
                html += `${data.text[i]}</span>`
            } else {
                html += data.text[i]
            }
        }     
        return html;
    }
}