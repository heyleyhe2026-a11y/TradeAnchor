#!/bin/bash

# TradeWise 增量部署脚本
# 只传输修改的源码到服务器进行构建

set -e

# ==================== 配置区 ====================
SERVER_USER="root"
SERVER_HOST="your-server-ip"  # 替换为你的服务器IP
SERVER_DIR="/opt/tradewise"    # 服务器上的项目目录
SSH_KEY="$HOME/.ssh/id_rsa"   # SSH密钥路径

# 需要同步的目录（相对于项目根目录）
SYNC_DIRS=(
    "packages/backend"
    "packages/frontend"
    "packages/shared"
)

# 需要同步的根级别文件
SYNC_FILES=(
    "package.json"
    "pnpm-lock.yaml"
    "pnpm-workspace.yaml"
    "tsconfig.json"
    "Dockerfile.backend"
    "Dockerfile.frontend"
    "docker-compose.yml"
    "docker-compose.prod.yml"
    ".dockerignore"
    ".eslintrc.json"
    ".prettierrc.json"
    ".prettierignore"
    ".gitignore"
)

# 排除的文件/目录模式
EXCLUDE_PATTERNS=(
    "node_modules/"
    "dist/"
    "build/"
    ".env*"
    "*.log"
    ".DS_Store"
    "__tests__"
    "*.test.ts"
    "*.test.tsx"
    "*.spec.ts"
    "*.spec.tsx"
    "coverage/"
)
# =================================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 构建 rsync 排除参数
build_exclude_args() {
    local args=""
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        args="$args --exclude=$pattern"
    done
    echo "$args"
}

# 检测 Git 变更文件
get_changed_files() {
    local files=()
    
    # 如果是 Git 仓库，获取未提交和已提交但未推送的变更
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # 未暂存的修改
        while IFS= read -r file; do
            [[ -n "$file" ]] && files+=("$file")
        done < <(git diff --name-only 2>/dev/null || true)
        
        # 已暂存的修改
        while IFS= read -r file; do
            [[ -n "$file" ]] && files+=("$file")
        done < <(git diff --cached --name-only 2>/dev/null || true)
        
        # 未跟踪的新文件（排除 .gitignore 中的）
        while IFS= read -r file; do
            [[ -n "$file" ]] && files+=("$file")
        done < <(git ls-files --others --exclude-standard 2>/dev/null || true)
    fi
    
    printf '%s\n' "${files[@]}"
}

# 过滤出需要同步的文件
filter_sync_files() {
    local changed_files=$1
    local sync_files=()
    
    while IFS= read -r file; do
        [[ -z "$file" ]] && continue
        
        # 检查是否在需要同步的目录中
        for dir in "${SYNC_DIRS[@]}"; do
            if [[ "$file" == "$dir"* ]]; then
                sync_files+=("$file")
                break
            fi
        done
        
        # 检查是否是需要同步的根级别文件
        for f in "${SYNC_FILES[@]}"; do
            if [[ "$(basename "$file")" == "$f" && ! "$file" =~ / ]]; then
                sync_files+=("$file")
                break
            fi
        done
    done <<< "$changed_files"
    
    printf '%s\n' "${sync_files[@]}"
}

# 增量同步单个文件或目录
sync_file() {
    local src=$1
    local dst=$2
    
    log_info "同步: $src"
    
    if [[ -d "$src" ]]; then
        rsync -avz --progress \
            $(build_exclude_args) \
            -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
            "$src/" \
            "${SERVER_USER}@${SERVER_HOST}:${dst}/"
    else
        rsync -avz --progress \
            $(build_exclude_args) \
            -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
            "$src" \
            "${SERVER_USER}@${SERVER_HOST}:${dst}/$(dirname "$src")"
    fi
}

# 全量同步（首次部署或强制全量）
full_sync() {
    log_info "开始全量同步..."
    
    # 同步目录
    for dir in "${SYNC_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            sync_file "$dir" "$SERVER_DIR/$dir"
        fi
    done
    
    # 同步根级别文件
    for file in "${SYNC_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            rsync -avz --progress \
                -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
                "$file" \
                "${SERVER_USER}@${SERVER_HOST}:${SERVER_DIR}/"
        fi
    done
    
    log_success "全量同步完成"
}

# 增量同步（只传修改的文件）
incremental_sync() {
    log_info "检测变更文件..."
    
    local changed_files
    changed_files=$(get_changed_files)
    
    if [[ -z "$changed_files" ]]; then
        log_warn "没有检测到变更文件"
        return 0
    fi
    
    log_info "发现以下变更文件:"
    echo "$changed_files" | head -20
    local file_count
    file_count=$(echo "$changed_files" | wc -l)
    if [[ $file_count -gt 20 ]]; then
        log_info "... 共 $file_count 个文件"
    fi
    
    # 过滤需要同步的文件
    local sync_files
    sync_files=$(filter_sync_files "$changed_files")
    
    if [[ -z "$sync_files" ]]; then
        log_warn "没有需要同步的文件（变更文件不在同步范围内）"
        return 0
    fi
    
    log_info "准备同步以下文件:"
    echo "$sync_files"
    
    # 创建变更文件清单
    local temp_file
    temp_file=$(mktemp)
    echo "$sync_files" > "$temp_file"
    
    # 使用 rsync 的 --files-from 选项进行增量同步
    log_info "开始增量同步..."
    rsync -avz --progress \
        $(build_exclude_args) \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
        --files-from="$temp_file" \
        ./ \
        "${SERVER_USER}@${SERVER_HOST}:${SERVER_DIR}/"
    
    rm -f "$temp_file"
    log_success "增量同步完成"
}

# 在服务器上执行构建
remote_build() {
    log_info "在服务器上执行构建..."
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" << 'REMOTE_COMMANDS'
set -e

cd /opt/tradewise

echo ">>> 安装依赖..."
pnpm install --frozen-lockfile || pnpm install

echo ">>> 构建共享包..."
cd packages/shared && pnpm build && cd ../..

echo ">>> 构建后端..."
cd packages/backend && pnpm build && cd ../..

echo ">>> 构建前端..."
cd packages/frontend && pnpm build && cd ../..

echo ">>> 重启服务..."
cd /opt/tradewise
docker compose down || true
docker compose up -d --build

echo ">>> 等待服务启动..."
sleep 10

echo ">>> 检查服务状态..."
docker compose ps

echo ">>> 查看日志..."
docker compose logs --tail=50

REMOTE_COMMANDS

    log_success "远程构建完成"
}

# 显示帮助信息
show_help() {
    cat << EOF
TradeWise 增量部署工具

用法: $0 [选项]

选项:
    -h, --help          显示帮助信息
    -f, --full          全量同步（首次部署使用）
    -i, --incremental   增量同步（只传输修改的文件，默认）
    -b, --build         同步后在服务器上执行构建
    -n, --no-sync       不同步，只在服务器上构建
    -s, --server=HOST   指定服务器地址
    -d, --dir=DIR       指定服务器目标目录
    --dry-run           试运行，显示将要同步的文件但不实际执行
    --show-changes      只显示变更文件列表，不同步

示例:
    $0 -i -b              # 增量同步 + 远程构建
    $0 -f -b              # 全量同步 + 远程构建（首次部署）
    $0 -i                 # 只增量同步，不构建
    $0 -b                 # 只在服务器构建（使用上次同步的代码）
    $0 --show-changes     # 查看有哪些文件被修改了
EOF
}

# 主函数
main() {
    local mode="incremental"
    local do_build=false
    local no_sync=false
    local dry_run=false
    local show_changes=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -f|--full)
                mode="full"
                shift
                ;;
            -i|--incremental)
                mode="incremental"
                shift
                ;;
            -b|--build)
                do_build=true
                shift
                ;;
            -n|--no-sync)
                no_sync=true
                shift
                ;;
            -s|--server)
                SERVER_HOST="$2"
                shift 2
                ;;
            -d|--dir)
                SERVER_DIR="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --show-changes)
                show_changes=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "========================================="
    echo "  TradeWise 增量部署工具"
    echo "========================================="
    echo "  服务器: ${SERVER_USER}@${SERVER_HOST}"
    echo "  目标目录: ${SERVER_DIR}"
    echo "  模式: ${mode}"
    echo "========================================="
    
    # 只显示变更文件
    if [[ "$show_changes" == "true" ]]; then
        log_info "检测到的变更文件:"
        get_changed_files
        exit 0
    fi
    
    # 试运行
    if [[ "$dry_run" == "true" ]]; then
        log_info "试运行模式 - 显示将要同步的文件:"
        if [[ "$mode" == "full" ]]; then
            log_warn "全量同步将传输所有源码文件"
        else
            get_changed_files | filter_sync_files
        fi
        exit 0
    fi
    
    # 执行同步
    if [[ "$no_sync" != "true" ]]; then
        case $mode in
            full)
                full_sync
                ;;
            incremental)
                incremental_sync
                ;;
        esac
    fi
    
    # 执行构建
    if [[ "$do_build" == "true" ]]; then
        remote_build
    fi
    
    log_success "部署流程完成！"
}

main "$@"
