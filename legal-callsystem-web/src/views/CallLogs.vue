<template>
  <div class="call-logs">
    <div class="header">
      <h2>通话记录</h2>
      <div class="header-actions">
        <el-select v-model="filterStatus" placeholder="全部状态" clearable style="width: 130px; margin-right: 10px" @change="loadLogs">
          <el-option label="已接通" value="answered" />
          <el-option label="已完成" value="completed" />
          <el-option label="未接通" value="no_answer" />
          <el-option label="已失败" value="failed" />
        </el-select>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索客户姓名..."
          style="width: 180px; margin-right: 10px"
          clearable
          @input="loadLogs"
        >
          <template #prefix>🔍</template>
        </el-input>
      </div>
    </div>

    <el-card>
      <el-table :data="paginatedLogs" style="width: 100%" v-loading="loading" @row-click="openDetail" :row-style="{ cursor: 'pointer' }">
        <el-table-column label="客户" width="100">
          <template #default="{ row }">
            {{ row.customer?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="电话" width="130">
          <template #default="{ row }">
            {{ row.customer?.phoneEncrypted ? '****' + row.customer.phoneEncrypted.slice(-4) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="案件类型" width="100">
          <template #default="{ row }">
            {{ row.customer?.caseType || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.callStatus)" size="small">{{ statusLabel(row.callStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="80">
          <template #default="{ row }">
            {{ row.duration > 0 ? formatDuration(row.duration) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="意向" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.intentResult === 'positive'" type="success" size="small">有意向</el-tag>
            <el-tag v-else-if="row.intentResult === 'negative'" type="danger" size="small">无意向</el-tag>
            <el-tag v-else-if="row.intentResult === 'callback'" type="warning" size="small">待回拨</el-tag>
            <span v-else style="color:#999;font-size:12px">-</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="">
          <template #default="{ row }">
            <el-icon v-if="row.localRecordingPath || row.recordingUrl" style="color:#409eff"><VideoPlay /></el-icon>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalLogs"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>
    </el-card>

    <!-- 通话详情弹窗 -->
    <el-dialog v-model="showDetail" title="通话详情" width="700px" @close="detailLog = null">
      <template v-if="detailLog">
        <el-descriptions :column="3" border size="small" style="margin-bottom: 20px">
          <el-descriptions-item label="客户">{{ detailLog.customer?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(detailLog.callStatus)" size="small">{{ statusLabel(detailLog.callStatus) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="时长">{{ detailLog.duration > 0 ? formatDuration(detailLog.duration) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="案件类型">{{ detailLog.customer?.caseType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="意向">
            <el-tag v-if="detailLog.intentResult === 'positive'" type="success" size="small">有意向</el-tag>
            <el-tag v-else-if="detailLog.intentResult === 'negative'" type="danger" size="small">无意向</el-tag>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="时间">{{ formatDate(detailLog.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <!-- 录音回放 -->
        <div v-if="hasRecording" class="recording-section">
          <h4>通话录音</h4>
          <audio v-if="recordingSrc" controls :src="recordingSrc" style="width: 100%; margin-top: 8px" preload="auto">
            您的浏览器不支持音频播放
          </audio>
          <div v-else-if="hasRecording" style="color:#999;text-align:center;padding:12px">录音加载中...</div>
        </div>

        <!-- 对话记录 -->
        <div class="transcript-section" style="margin-top: 20px">
          <h4>对话记录</h4>
          <div v-if="detailLog.transcript && detailLog.transcript.length > 0" class="chat-bubbles">
            <div v-for="(msg, idx) in detailLog.transcript" :key="idx" :class="['bubble', msg.role === 'user' ? 'bubble-user' : 'bubble-ai']">
              <div class="bubble-role">{{ msg.role === 'user' ? '客户' : 'AI' }}</div>
              <div class="bubble-text">{{ msg.content }}</div>
            </div>
          </div>
          <div v-else style="text-align:center;color:#999;padding:20px">
            暂无对话记录
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay } from '@element-plus/icons-vue'
import axios from 'axios'

const logs = ref([])
const loading = ref(false)
const showDetail = ref(false)
const detailLog = ref(null)
const searchKeyword = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const totalLogs = ref(0)

const statusMap = {
  initiated: '已发起', answered: '已接通', completed: '已完成',
  no_answer: '未接通', busy: '占线', rejected: '已拒绝', failed: '已失败',
}
const statusTag = (s) => {
  if (s === 'completed' || s === 'answered') return 'success'
  if (s === 'failed' || s === 'rejected') return 'danger'
  if (s === 'no_answer' || s === 'busy') return 'warning'
  return 'info'
}
const statusLabel = (s) => statusMap[s] || s || '-'

const recordingSrc = ref('')
const hasRecording = computed(() => {
  return detailLog.value?.recordingUrl || detailLog.value?.localRecordingPath
})

const paginatedLogs = computed(() => {
  return logs.value
})

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const loadLogs = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    if (!token) return
    const params = { page: currentPage.value, limit: pageSize.value }
    if (filterStatus.value) params.status = filterStatus.value
    if (searchKeyword.value) params.keyword = searchKeyword.value

    const { data } = await axios.get('/calls/logs', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    })

    const list = Array.isArray(data) ? data[0] || [] : (data?.items || [])
    totalLogs.value = Array.isArray(data) ? (data[1] || list.length) : (data?.total || list.length)
    logs.value = list
  } catch (e) {
    console.error('加载通话记录失败:', e)
  } finally {
    loading.value = false
  }
}

const openDetail = async (row) => {
  detailLog.value = row
  showDetail.value = true
  recordingSrc.value = ''

  const token = localStorage.getItem('token')

  // 并行加载详情和录音
  const promises = []

  if (row.callId && !row.transcript) {
    promises.push(
      axios.get(`/calls/logs/${row.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          if (data.transcript) {
            detailLog.value = { ...detailLog.value, transcript: data.transcript }
          }
        })
        .catch(() => {})
    )
  }

  if (row.callId && (row.recordingUrl || row.localRecordingPath)) {
    promises.push(
      axios.get(`/calls/recording/${row.callId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
        .then(({ data }) => {
          recordingSrc.value = URL.createObjectURL(data)
        })
        .catch(() => {})
    )
  }

  await Promise.all(promises)
}

onMounted(loadLogs)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header-actions {
  display: flex;
  align-items: center;
}
.pagination-wrap {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.recording-section h4,
.transcript-section h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #333;
}

.chat-bubbles {
  max-height: 350px;
  overflow-y: auto;
  padding: 8px 0;
}
.bubble {
  margin-bottom: 12px;
  padding: 8px 14px;
  border-radius: 10px;
  max-width: 80%;
}
.bubble-user {
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  margin-right: auto;
}
.bubble-ai {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  margin-left: auto;
  text-align: right;
}
.bubble-role {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}
.bubble-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}
</style>
