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

onMounted(loadCustomers)
</script>

<script>
import axios from 'axios'
export default {}
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
</style>