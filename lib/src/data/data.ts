import { calculateMean, groupBy } from "../utils/utils.js";

export interface IReflectionAuthor {
    timestamp: Date;
    pseudonym: string;
    point: number;
    text: string;
}

export interface IAdminAnalyticsData {
    group: string;
    value: IReflectionAuthor[];
    creteDate: Date;
    colour: string;
    selected: boolean;
    getUsersData(): AdminAnalyticsData;
}

export class AdminAnalyticsData implements IAdminAnalyticsData {
    group: string;
    value: IReflectionAuthor[];
    creteDate: Date;
    colour: string;
    selected: boolean;
    constructor(group: string, value: IReflectionAuthor[], createDate: Date = undefined, colour: string = undefined, selected: boolean = false) {
        this.group = group;
        this.value = value;
        this.creteDate = createDate;
        this.colour = colour;
        this.selected = selected;
    }
    getUsersData(): AdminAnalyticsData {
        let usersMean = groupBy(this.value, "pseudonym").map(d => { return { "pseudonym": d.key, "point": calculateMean(d.value.map(d => d.point))} as IReflectionAuthor})
        return new AdminAnalyticsData(this.group, usersMean, this.creteDate, this.colour);
    }
}

export interface IDataStats {
    stat: string;
    displayName: string;
    value: number | Date;
}

export class DataStats implements IDataStats {
    stat: string;
    displayName: string;
    value: number | Date;
    constructor(stat: string, displayName: string, value: number | Date){
        this.stat = stat,
        this.displayName = displayName,
        this.value = value
    }
}

export interface IAdminAnalyticsDataStats extends IAdminAnalyticsData {
    stats: IDataStats[];
    getStat(stat: string): IDataStats;
}

export class AdminAnalyticsDataStats extends AdminAnalyticsData implements IAdminAnalyticsDataStats {
    stats: IDataStats[];
    constructor(entries: IAdminAnalyticsData) {
        super(entries.group, entries.value, entries.creteDate, entries.colour, entries.selected);
        let uniqueUsers = groupBy(entries.value, "pseudonym");
        this.stats = [];
        this.stats.push(new DataStats("usersTotal", "Users", uniqueUsers.length))
        this.stats.push(new DataStats("refTotal", "Reflections", entries.value.length))
        this.stats.push(new DataStats("mean", "Mean", Math.round(calculateMean(entries.value.map(r => r.point)))));
        this.stats.push(new DataStats("oldRef", "Oldest reflection", new Date(Math.min.apply(null, entries.value.map(r => new Date(r.timestamp))))))
        this.stats.push(new DataStats("newRef", "Newest reflection", new Date(Math.max.apply(null, entries.value.map(r => new Date(r.timestamp))))))
        this.stats.push(new DataStats("ruRate", "Reflections per user", Math.round(entries.value.length / uniqueUsers.length * 100) / 100))
    };
    getStat(stat: string): IDataStats {
        var exists = this.stats.find(d => d.stat == stat);
        if (exists != undefined) {
            return exists;
        } else {
            return new DataStats("na", "Not found", 0);
        }
    }
}

export interface ITimelineData extends IReflectionAuthor {
    colour: string;
    group: string;
}

export class TimelineData implements ITimelineData {
    timestamp: Date;
    pseudonym: string;
    point: number;
    text: string;
    colour: string;
    group: string;
    constructor(data: IReflectionAuthor, colour: string, group: string) {
        this.timestamp = data.timestamp;
        this.pseudonym = data.pseudonym;
        this.point = data.point;
        this.text = data.text;
        this.colour = colour;
        this.group = group;
    }
}

export interface IHistogramData extends IAdminAnalyticsData {
    bin: d3.Bin<number, number>;
    percentage: number;
}

export class HistogramData extends AdminAnalyticsData implements IHistogramData {    
    bin: d3.Bin<number, number>;
    percentage: number;
    constructor(value: IReflectionAuthor[], group: string, colour: string, bin: d3.Bin<number, number>, percentage: number) {
        super(group, value, undefined, colour);
        this.bin = bin;
        this.percentage = percentage;
    }
}

export interface IUserChartData {
    binName: string;
    percentage: number;
    value: IReflectionAuthor[];
    isGroup: boolean;
}

export class UserChartData implements IUserChartData {
    binName: string;
    percentage: number;
    value: IReflectionAuthor[];
    isGroup: boolean;
    constructor(bin: d3.Bin<number, number>, value: IReflectionAuthor[], percentage: number, isGroup: boolean) {
        if(bin.x0 == 0) {
            this.binName = "distressed";
        } else if(bin.x1 == 100) {
            this.binName = "soaring";
        } else {
            this.binName = "going ok";
        }
        this.percentage = percentage;
        this.isGroup = isGroup;
    }
}

export interface IClickTextData {
    clickData: {stat: IDataStats | number, group: string};
    data: {stat: IDataStats | number, group: string};
}

export class ClickTextData implements IClickTextData {
    clickData: {stat: IDataStats | number, group: string};
    data: {stat: IDataStats | number, group: string};
    constructor(clickStat: IDataStats | number, dataStat: IDataStats | number, clickGroup: string, dataGroup: string) {
        this.clickData = {stat: clickStat, group: clickGroup},
        this.data = {stat: dataStat, group: dataGroup}
    }
}

export interface ITags extends d3.SimulationNodeDatum {
    start_index?: number,
    tag: string,
    phrase: string,
    colour?: string,
    end_index?: number,
    selected?: boolean
}

export interface ILinks<T> extends d3.SimulationLinkDatum<T> {
    weight: number;
    isReflection?: boolean;
}

export interface IReflectionAnalytics {
    tags: ITags[],
    matrix: number[][]
}

export interface IRelfectionAuthorAnalytics extends IReflectionAuthor, IReflectionAnalytics {
}

export interface INetworkData {
    nodes: ITags[],
    links: ILinks<ITags>[]
}