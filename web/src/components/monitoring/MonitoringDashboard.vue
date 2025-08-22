<template>
  <div class="monitoring-dashboard">
    <n-card title="System Monitoring Dashboard" class="mb-4">
      <n-space>
        <n-button type="primary" @click="refreshData" :loading="loading">
          <template #icon>
            <n-icon><RefreshIcon /></n-icon>
          </template>
          Refresh
        </n-button>
        <n-switch v-model:value="autoRefresh" @update:value="toggleAutoRefresh">
          <template #checked>Auto Refresh: ON</template>
          <template #unchecked>Auto Refresh: OFF</template>
        </n-switch>
      </n-space>
    </n-card>

    <n-grid cols="1 s:2 m:3 l:4" responsive="screen" :x-gap="16" :y-gap="16">
      <!-- System Health -->
      <n-gi>
        <n-card title="System Health">
          <div class="health-indicator">
            <n-tag 
              :type="healthStatus?.status === 'healthy' ? 'success' : 
                    healthStatus?.status === 'degraded' ? 'warning' : 'error'"
              round
            >
              {{ healthStatus?.status?.toUpperCase() || 'UNKNOWN' }}
            </n-tag>
            <p class="mt-2">
              Uptime: {{ formatUptime(healthStatus?.uptime || 0) }}
            </p>
            <p>
              Version: {{ healthStatus?.version || 'Unknown' }}
            </p>
          </div>
        </n-card>
      </n-gi>

      <!-- Performance -->
      <n-gi>
        <n-card title="Performance">
          <n-statistic
            label="Response Time"
            :value="performanceData?.metrics?.responseTime || 0"
            suffix="ms"
            :value-style="getValueStyle(performanceData?.metrics?.responseTime, 1000)"
          />
          <n-statistic
            label="Health Score"
            :value="performanceData?.healthScore || 0"
            suffix="/100"
            :value-style="getValueStyle(100 - (performanceData?.healthScore || 0), 30)"
            class="mt-2"
          />
        </n-card>
      </n-gi>

      <!-- Alerts -->
      <n-gi>
        <n-card title="Alerts">
          <n-statistic
            label="Active Alerts"
            :value="alertData?.stats?.recentCount || 0"
            :value-style="getValueStyle(alertData?.stats?.recentCount, 0)"
          />
          <div class="alert-breakdown mt-2">
            <n-tag type="error" size="small" v-if="alertData?.stats?.bySeverity?.critical">
              Critical: {{ alertData.stats.bySeverity.critical }}
            </n-tag>
            <n-tag type="warning" size="small" v-if="alertData?.stats?.bySeverity?.warning">
              Warning: {{ alertData.stats.bySeverity.warning }}
            </n-tag>
          </div>
        </n-card>
      </n-gi>

      <!-- Security -->
      <n-gi>
        <n-card title="Security">
          <n-statistic
            label="Risk Score"
            :value="securityData?.metrics?.riskScore || 0"
            suffix="/10"
            :value-style="getValueStyle(securityData?.metrics?.riskScore, 5)"
          />
          <n-statistic
            label="Events (24h)"
            :value="securityData?.metrics?.totalEvents || 0"
            :value-style="getValueStyle(securityData?.metrics?.totalEvents, 10)"
            class="mt-2"
          />
        </n-card>
      </n-gi>
    </n-grid>

    <!-- Charts Row -->
    <n-grid cols="1 s:1 m:2" responsive="screen" :x-gap="16" :y-gap="16" class="mt-4">
      <n-gi>
        <n-card title="Top Metrics (24h)">
          <n-list>
            <n-list-item v-for="metric in businessData?.topMetrics?.slice(0, 8)" :key="metric.metric">
              <div class="flex justify-between items-center w-full">
                <span class="text-sm">{{ formatMetricName(metric.metric) }}</span>
                <div class="flex items-center space-x-2">
                  <n-tag size="small" :type="getTrendType(metric.trend)">
                    {{ metric.totalValue }}
                  </n-tag>
                  <n-icon :class="getTrendIcon(metric.trend)">
                    <ArrowUpIcon v-if="metric.trend === 'up'" />
                    <ArrowDownIcon v-if="metric.trend === 'down'" />
                    <MinusIcon v-if="metric.trend === 'stable'" />
                  </n-icon>
                </div>
              </div>
            </n-list-item>
          </n-list>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card title="Recent Alerts">
          <n-list>
            <n-list-item v-for="alert in alertData?.recent?.slice(0, 8)" :key="alert.id">
              <div class="flex justify-between items-center w-full">
                <div>
                  <div class="font-medium text-sm">{{ alert.title }}</div>
                  <div class="text-xs text-gray-500">{{ formatTime(alert.timestamp) }}</div>
                </div>
                <n-tag :type="getAlertType(alert.severity)" size="small">
                  {{ alert.severity.toUpperCase() }}
                </n-tag>
              </div>
            </n-list-item>
          </n-list>
        </n-card>
      </n-gi>
    </n-grid>

    <!-- Performance Details -->
    <n-card title="Performance Details" class="mt-4">
      <n-grid cols="1 s:2 m:4" responsive="screen" :x-gap="16" :y-gap="16">
        <n-gi>
          <n-statistic
            label="DB Response"
            :value="performanceData?.metrics?.responseTime || 0"
            suffix="ms"
          />
        </n-gi>
        <n-gi>
          <n-statistic
            label="Connection Pool"
            :value="Math.round(performanceData?.metrics?.connectionPoolUsage || 0)"
            suffix="%"
          />
        </n-gi>
        <n-gi>
          <n-statistic
            label="Active Connections"
            :value="performanceData?.metrics?.activeConnections || 0"
          />
        </n-gi>
        <n-gi>
          <n-statistic
            label="Slow Queries"
            :value="performanceData?.metrics?.slowQueries || 0"
          />
        </n-gi>
      </n-grid>

      <div v-if="performanceData?.recommendations?.length" class="mt-4">
        <h4 class="mb-2">Recommendations:</h4>
        <n-list>
          <n-list-item v-for="(rec, index) in performanceData.recommendations" :key="index">
            <n-text depth="2">{{ rec }}</n-text>
          </n-list-item>
        </n-list>
      </div>
    </n-card>

    <!-- Security Events -->
    <n-card title="Recent Security Events" class="mt-4" v-if="securityData?.events?.length">
      <n-data-table
        :columns="securityColumns"
        :data="securityData.events"
        :pagination="{ pageSize: 10 }"
        :row-key="(row: any) => row.id"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, h } from 'vue'
import { 
  NCard, NGrid, NGi, NStatistic, NTag, NButton, NIcon, NSpace, NSwitch, 
  NList, NListItem, NText, NDataTable, useMessage
} from 'naive-ui'
import { api } from '../../api/axios'
import { Refresh as RefreshIcon, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon, Minus as MinusIcon } from '@vicons/ionicons5'

// Reactive data
const loading = ref(false)
const autoRefresh = ref(false)
const refreshInterval = ref<NodeJS.Timeout>()

// Data stores
const healthStatus = ref<any>(null)
const businessData = ref<any>(null)
const alertData = ref<any>(null)
const securityData = ref<any>(null)
const performanceData = ref<any>(null)

const message = useMessage()

// Security events table columns
const securityColumns = [
  { title: 'Time', key: 'timestamp', render: (row: any) => formatTime(row.timestamp) },
  { title: 'Type', key: 'type', render: (row: any) => row.type.replace(/_/g, ' ').toUpperCase() },
  { 
    title: 'Severity', 
    key: 'severity', 
    render: (row: any) => h(NTag, { type: getAlertType(row.severity), size: 'small' }, row.severity.toUpperCase())
  },
  { title: 'Source', key: 'source' },
  { title: 'User', key: 'userEmail', render: (row: any) => row.userEmail || 'N/A' },
  { title: 'IP', key: 'ipAddress', render: (row: any) => row.ipAddress || 'N/A' }
]

// Helper functions
const formatUptime = (uptime: number): string => {
  if (uptime < 60) return `${Math.round(uptime)}s`
  if (uptime < 3600) return `${Math.round(uptime / 60)}m`
  if (uptime < 86400) return `${Math.round(uptime / 3600)}h`
  return `${Math.round(uptime / 86400)}d`
}

const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatMetricName = (metric: string): string => {
  return metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const getValueStyle = (value: number, threshold: number): any => {
  if (value > threshold) {
    return { color: '#d03050' }
  } else if (value > threshold * 0.7) {
    return { color: '#f0a020' }
  }
  return { color: '#18a058' }
}

const getTrendType = (trend: string): 'success' | 'warning' | 'info' => {
  switch (trend) {
    case 'up': return 'success'
    case 'down': return 'warning'
    default: return 'info'
  }
}

const getTrendIcon = (trend: string): string => {
  switch (trend) {
    case 'up': return 'text-green-500'
    case 'down': return 'text-red-500'
    default: return 'text-gray-500'
  }
}

const getAlertType = (severity: string): 'error' | 'warning' | 'info' | 'success' => {
  switch (severity) {
    case 'critical': return 'error'
    case 'high': return 'error'
    case 'warning': return 'warning'
    case 'medium': return 'warning'
    case 'low': return 'info'
    case 'info': return 'info'
    default: return 'info'
  }
}

// Data fetching
const fetchHealthStatus = async () => {
  try {
    const response = await api.get('/health')
    healthStatus.value = response.data
  } catch (error) {
    console.error('Failed to fetch health status:', error)
  }
}

const fetchBusinessMetrics = async () => {
  try {
    const response = await api.get('/metrics/business')
    businessData.value = response.data
    alertData.value = response.data.alerts
    securityData.value = response.data.security
    performanceData.value = response.data.performance
  } catch (error: any) {
    console.error('Failed to fetch business metrics:', error)
    if (error.response?.status === 403) {
      message.error('Admin access required for monitoring dashboard')
    }
  }
}

const refreshData = async () => {
  loading.value = true
  try {
    await Promise.all([
      fetchHealthStatus(),
      fetchBusinessMetrics()
    ])
  } catch (error) {
    message.error('Failed to refresh monitoring data')
  } finally {
    loading.value = false
  }
}

const toggleAutoRefresh = (enabled: boolean) => {
  if (enabled) {
    refreshInterval.value = setInterval(refreshData, 30000) // Refresh every 30 seconds
  } else {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = undefined
    }
  }
}

// Lifecycle
onMounted(() => {
  refreshData()
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<style scoped>
.monitoring-dashboard {
  padding: 16px;
}

.health-indicator {
  text-align: center;
}

.alert-breakdown {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>