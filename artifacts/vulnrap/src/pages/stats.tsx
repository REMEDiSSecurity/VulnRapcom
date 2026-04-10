import { useGetStats, useGetRecentActivity, useGetSlopDistribution, getGetStatsQueryKey, getGetRecentActivityQueryKey, getGetSlopDistributionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, BarChart3, Database, ShieldAlert, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function Stats() {
  const { data: stats, isLoading: statsLoading } = useGetStats({ query: { queryKey: getGetStatsQueryKey() } });
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const { data: distribution, isLoading: distLoading } = useGetSlopDistribution({ query: { queryKey: getGetSlopDistributionQueryKey() } });

  const formatNumber = (num: number) => new Intl.NumberFormat().format(num);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold uppercase tracking-tight flex items-center gap-2">
          <Activity className="w-8 h-8 text-primary" />
          Platform Statistics
        </h1>
        <p className="text-muted-foreground mt-2">Aggregate metrics across the VulnRap validation network.</p>
      </div>

      {/* Top Level Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Total Reports</div>
              <Database className="w-4 h-4 text-primary" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-mono font-bold">{formatNumber(stats?.totalReports || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Duplicates</div>
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-mono font-bold text-destructive">{formatNumber(stats?.duplicatesDetected || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Avg Slop</div>
              <BarChart3 className="w-4 h-4 text-yellow-500" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-mono font-bold">{Math.round(stats?.avgSlopScore || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Today</div>
              <Users className="w-4 h-4 text-secondary" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-mono font-bold text-secondary">{formatNumber(stats?.reportsToday || 0)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Slop Distribution */}
        <Card className="lg:col-span-2 bg-card/40 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground">Slop Score Distribution</CardTitle>
            <CardDescription>Histogram of AI-generation probability</CardDescription>
          </CardHeader>
          <CardContent>
            {distLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : distribution?.buckets ? (
              <div className="flex items-end gap-2 h-64 mt-4 pt-4 border-b border-border/50 px-2">
                {distribution.buckets.map((bucket, i) => {
                  const maxCount = Math.max(...distribution.buckets.map(b => b.count));
                  const heightPct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                      <div className="w-full flex justify-center items-end h-full">
                        <div 
                          className="w-full bg-primary/60 hover:bg-primary transition-colors rounded-t-sm"
                          style={{ height: `${Math.max(heightPct, 1)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono -rotate-45 md:rotate-0 origin-top-left md:origin-center mt-2 w-full text-center whitespace-nowrap">
                        {bucket.label}
                      </div>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs px-2 py-1 rounded pointer-events-none z-10 font-mono">
                        {bucket.count} reports
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card/40 backdrop-blur border-border flex flex-col">
          <CardHeader>
            <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground">Recent Scans</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : activity?.recentReports && activity.recentReports.length > 0 ? (
              <div className="space-y-4">
                {activity.recentReports.map((report) => (
                  <Link key={report.id} to={`/results/${report.id}`} className="block">
                    <div className="p-3 border border-border/50 rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-mono text-sm text-primary">#{report.id}</div>
                        <div className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleTimeString()}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className={
                          report.slopScore > 70 ? "border-destructive text-destructive" :
                          report.slopScore > 30 ? "border-yellow-500 text-yellow-500" :
                          "border-green-500 text-green-500"
                        }>
                          {report.slopTier}
                        </Badge>
                        <span className="text-xs font-mono">
                          {report.matchCount > 0 ? `${report.matchCount} matches` : 'Clean'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">No recent activity</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
