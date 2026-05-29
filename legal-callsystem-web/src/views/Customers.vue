<template>
  <div class="customers">
    <div class="header">
      <h2>客户管理</h2>
      <div class="header-actions">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索姓名或电话..." 
          style="width: 200px; margin-right: 10px;"
          clearable
          @input="loadCustomers"
        >
          <template #prefix>🔍</template>
        </el-input>
        <el-button type="primary" @click="openAddDialog">+ 添加客户</el-button>
        <el-button @click="showImportDialog = true">批量导入</el-button>
      </div>
    </div>

    <el-card>
      <el-table :data="paginatedCustomers" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column label="电话" width="140">
          <template #default="{ row }">
            <span v-if="row.phoneVisible">{{ row.phone }}</span>
            <span v-else class="phone-masked">****{{ row.phoneEncrypted?.slice(-4) }}</span>
            <el-button size="small" text @click="togglePhoneVisible(row)">
              {{ row.phoneVisible ? '隐藏' : '显示' }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="caseType" label="案件类型" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-select 
              v-model="row.status" 
              size="small" 
              style="width: 100px"
              @change="updateStatus(row)"
            >
              <el-option label="新客户" value="new" />
              <el-option label="已联系" value="contacted" />
              <el-option label="有意向" value="interested" />
              <el-option label="已添微信" value="wechat_added" />
              <el-option label="已预约" value="appointed" />
              <el-option label="已成交" value="closed" />
              <el-option label="已拒绝" value="rejected" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="80" />
        <el-table-column prop="createdAt" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteCustomer(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalCustomers"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadCustomers"
          @current-change="loadCustomers"
        />
      </div>
    </el-card>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="showImportDialog" title="批量导入客户" width="650px" @close="resetImport">
      <el-tabs v-model="importTab">
        <el-tab-pane label="粘贴文本" name="paste">
          <div class="import-hint">
            每行一个客户，格式：<code>姓名,电话,案件类型,来源</code><br/>
            案件类型和来源可选，不填则默认为"其他"
          </div>
          <el-input
            v-model="importText"
            type="textarea"
            :rows="10"
            placeholder="张三,13800001111,民事纠纷,主动咨询&#10;李四,13900002222,劳动纠纷&#10;王五,13700003333"
          />
        </el-tab-pane>
        <el-tab-pane label="上传CSV" name="file">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".csv,.txt"
            :on-change="handleFileChange"
            :on-remove="() => { importText = ''; parsedCustomers = [] }"
          >
            <el-button type="primary">选择 CSV 文件</el-button>
            <template #tip>
              <div class="import-hint">支持 .csv / .txt，每行格式同上</div>
            </template>
          </el-upload>
        </el-tab-pane>
      </el-tabs>

      <div v-if="parsedCustomers.length > 0" style="margin-top: 16px">
        <div class="import-summary">
          解析到 <strong>{{ parsedCustomers.length }}</strong> 条客户记录
        </div>
        <el-table :data="parsedCustomers" max-height="250" size="small" style="margin-top: 8px">
          <el-table-column prop="name" label="姓名" width="90" />
          <el-table-column prop="phone" label="电话" width="130" />
          <el-table-column prop="caseType" label="案件类型" width="100" />
          <el-table-column prop="source" label="来源" width="100" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag v-if="row._result" :type="row._result.success ? 'success' : 'danger'" size="small">
                {{ row._result.success ? '成功' : '失败' }}
              </el-tag>
              <span v-else style="color:#999;font-size:12px">待导入</span>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="120">
            <template #default="{ row }">
              <span v-if="row._result && !row._result.success" style="color:#f56c6c;font-size:12px">
                {{ row._result.error }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="showImportDialog = false">关闭</el-button>
        <el-button @click="parseImportText" :disabled="!importText.trim()">解析预览</el-button>
        <el-button type="primary" @click="doBatchImport" :loading="importing" :disabled="parsedCustomers.length === 0">
          导入 ({{ parsedCustomers.length }} 条)
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="showDialog" :title="isEdit ? '编辑客户' : '添加客户'" width="500px" @close="resetForm">
      <el-form :model="form" label-width="80px" :rules="rules" ref="formRef">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入客户姓名" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入客户电话" />
        </el-form-item>
        <el-form-item label="案件类型" prop="caseType">
          <el-select v-model="form.caseType" placeholder="请选择案件类型" style="width: 100%">
            <el-option label="民事纠纷" value="民事纠纷" />
            <el-option label="刑事案件" value="刑事案件" />
            <el-option label="婚姻家庭" value="婚姻家庭" />
            <el-option label="房产纠纷" value="房产纠纷" />
            <el-option label="债务纠纷" value="债务纠纷" />
            <el-option label="合同纠纷" value="合同纠纷" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="form.source" placeholder="请选择来源" style="width: 100%">
            <el-option label="主动咨询" value="consultation" />
            <el-option label="电话咨询" value="phone" />
            <el-option label="微信" value="wechat" />
            <el-option label="转介绍" value="referral" />
            <el-option label="线上推广" value="online" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="其他备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveCustomer" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const customers = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const isEdit = ref(false)
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const totalCustomers = ref(0)
const formRef = ref(null)
const showImportDialog = ref(false)
const importTab = ref('paste')
const importText = ref('')
const parsedCustomers = ref([])
const importing = ref(false)

// 案件类型映射（CSV中可能用中文或英文）
const caseTypeMap = {
  '民事纠纷': '民事纠纷', '民事': '民事纠纷',
  '刑事': '刑事案件', '刑事案件': '刑事案件',
  '婚姻': '婚姻家庭', '婚姻家庭': '婚姻家庭',
  '房产': '房产纠纷', '房产纠纷': '房产纠纷',
  '债务': '债务纠纷', '债务纠纷': '债务纠纷',
  '合同': '合同纠纷', '合同纠纷': '合同纠纷',
}

const sourceMap = {
  '主动咨询': 'consultation', '电话咨询': 'phone', '微信': 'wechat',
  '转介绍': 'referral', '线上推广': 'online', '其他': 'other',
  'consultation': 'consultation', 'phone': 'phone', 'wechat': 'wechat',
  'referral': 'referral', 'online': 'online', 'other': 'other',
}

const form = ref({
  id: '',
  name: '',
  phone: '',
  caseType: '',
  source: 'other',
  notes: ''
})

const rules = {
  name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入客户电话', trigger: 'blur' }],
  caseType: [{ required: true, message: '请选择案件类型', trigger: 'change' }]
}

// 分页后的客户列表
const paginatedCustomers = computed(() => {
  let list = customers.value
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(c => 
      c.name?.toLowerCase().includes(kw) || 
      (c.phoneEncrypted && c.phoneEncrypted.slice(-4).includes(kw))
    )
    totalCustomers.value = list.length
  }
  const start = (currentPage.value - 1) * pageSize.value
  return list.slice(start, start + pageSize.value)
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const togglePhoneVisible = (row) => {
  row.phoneVisible = !row.phoneVisible
}

const loadCustomers = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      ElMessage.warning('请先登录')
      return
    }
    
    const { data } = await axios.get('/customers', { 
      headers: { Authorization: `Bearer ${token}` },
      params: { page: currentPage.value, limit: pageSize.value }
    })
    
    let customerList = []
    if (Array.isArray(data)) {
      customerList = data[0] || data || []
    } else if (data && data[0]) {
      customerList = data[0]
    } else if (data && data.items) {
      customerList = data.items
    }
    
    totalCustomers.value = customerList.length
    customers.value = customerList.map(c => ({
      ...c,
      phoneVisible: false
    }))
  } catch (e) {
    console.error('加载客户失败:', e)
    ElMessage.error('加载失败: ' + (e.response?.status || e.message))
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  isEdit.value = false
  resetForm()
  showDialog.value = true
}

const openEditDialog = (row) => {
  isEdit.value = true
  form.value = { 
    id: row.id,
    name: row.name,
    phone: row.phoneEncrypted ? '已加密' : row.phone,
    caseType: row.caseType,
    source: row.source || 'other',
    notes: row.notes || ''
  }
  showDialog.value = true
}

const resetForm = () => {
  form.value = {
    id: '',
    name: '',
    phone: '',
    caseType: '',
    source: 'other',
    notes: ''
  }
}

const saveCustomer = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.value = true
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      if (isEdit.value) {
        // 编辑 - 过滤掉加密的电话
        const updateData = { ...form.value }
        if (updateData.phone === '已加密') {
          delete updateData.phone
        }
        delete updateData.id
        await axios.patch(`/customers/${form.value.id}`, updateData, { headers })
        ElMessage.success('修改成功')
      } else {
        // 新增
        await axios.post('/customers', form.value, { headers })
        ElMessage.success('添加成功')
      }
      
      showDialog.value = false
      resetForm()
      loadCustomers()
    } catch (e) {
      console.error('保存客户失败:', e)
      const errMsg = e.response?.data?.message || e.message || '未知错误'
      ElMessage.error('保存失败: ' + errMsg)
    } finally {
      saving.value = false
    }
  })
}

const updateStatus = async (row) => {
  try {
    const token = localStorage.getItem('token')
    await axios.patch(`/customers/${row.id}/status`, 
      { status: row.status },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    ElMessage.success('状态已更新')
  } catch (e) {
    ElMessage.error('更新状态失败')
    loadCustomers() // 恢复原状态
  }
}

const deleteCustomer = async (id) => {
  try {
    await ElMessageBox.confirm('确定删除该客户?', '警告', { type: 'warning' })
    const token = localStorage.getItem('token')
    await axios.delete(`/customers/${id}`, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
    ElMessage.success('删除成功')
    loadCustomers()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const parseImportText = () => {
  parsedCustomers.value = []
  const lines = importText.value.trim().split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(',').map(s => s.trim())
    if (parts.length < 2) continue
    const caseType = caseTypeMap[parts[2]] || parts[2] || '其他'
    const source = sourceMap[parts[3]] || 'other'
    parsedCustomers.value.push({
      name: parts[0],
      phone: parts[1],
      caseType,
      source,
    })
  }
  if (parsedCustomers.value.length === 0) {
    ElMessage.warning('未解析到有效数据，请检查格式：姓名,电话,案件类型,来源')
  } else {
    ElMessage.success(`解析到 ${parsedCustomers.value.length} 条记录`)
  }
}

const handleFileChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    importText.value = e.target.result
    parseImportText()
  }
  reader.readAsText(file.raw)
}

const doBatchImport = async () => {
  if (parsedCustomers.value.length === 0) return
  importing.value = true
  try {
    const token = localStorage.getItem('token')
    const { data } = await axios.post('/customers/batch',
      { customers: parsedCustomers.value },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    for (let i = 0; i < parsedCustomers.value.length; i++) {
      parsedCustomers.value[i]._result = data[i] || { success: false, error: '无返回' }
    }

    const successCount = data.filter(r => r.success).length
    const failCount = data.length - successCount
    if (failCount === 0) {
      ElMessage.success(`全部 ${successCount} 条导入成功`)
      loadCustomers()
    } else {
      ElMessage.warning(`导入完成：${successCount} 成功，${failCount} 失败`)
    }
  } catch (e) {
    ElMessage.error('导入请求失败: ' + (e.response?.data?.message || e.message))
  } finally {
    importing.value = false
  }
}

const resetImport = () => {
  importText.value = ''
  parsedCustomers.value = []
  importTab.value = 'paste'
}

onMounted(loadCustomers)
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

.phone-masked {
  color: #999;
  font-size: 12px;
}

.pagination-wrap {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.import-hint {
  color: #999;
  font-size: 12px;
  margin-bottom: 10px;
  line-height: 1.6;
}
.import-hint code {
  background: #f5f5f5;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.import-summary {
  font-size: 14px;
  color: #333;
}
</style>