/**
 * Browser half of the prompt library.
 *
 * Two triggers open one dialog: the small chip in the composer tool row (which
 * can insert a saved prompt into the draft) and the sidebar-foot row (which
 * works with no session at all). Entries come from the Host route
 * `api/prompt-library/prompts`; nothing is cached in localStorage, so the
 * panel, the tools, and the file always agree.
 */
window.__ModuleLoader__.load({
  id: 'dsh-prompt-library',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'prompt-library'
    const ROUTE = 'api/prompt-library/prompts'

    // The host's shared controls (Switch, ...) from the shell's module table, same as media-viewer. A host without
    // them keeps the panel and simply skips the plugin page's settings card. (The state object below is `ui`, so
    // the primitives take the name `primitives`.)
    let primitives = null
    try { primitives = require('@deepseek-ai/dsh-client-ui-primitives') } catch { primitives = null }

    const DICT_ZH = {
      'trigger.label': '提示词',
      'trigger.hint': '打开提示词库：插入、复制或管理已保存的提示词',
      'panel.title': '提示词库',
      'action.new': '新建',
      'action.refresh': '刷新',
      'action.close': '关闭',
      'action.retry': '重试',
      'action.insert': '插入',
      'action.copy': '复制',
      'action.edit': '编辑',
      'action.delete': '删除',
      'action.confirmDelete': '确认删除',
      'action.save': '保存',
      'action.saving': '保存中…',
      'action.cancel': '取消',
      'search.label': '搜索提示词',
      'search.placeholder': '搜索标题、正文或标签',
      'tags.all': '全部',
      'tags.filter': '按标签筛选',
      'tags.common': '常用标签',
      'list.loading': '正在读取提示词…',
      'list.empty': '还没有提示词。新建一条，或让 Agent 用 prompt_save 工具记下来。',
      'list.noMatch': '没有匹配的提示词',
      'card.untagged': '未分类',
      'card.chars': '字',
      'card.source': '来源',
      'field.title': '标题',
      'field.titlePlaceholder': '留空则取正文第一行',
      'field.tags': '标签',
      'field.tagsPlaceholder': '用逗号分隔，例如：架构图, codex',
      'field.source': '来源链接',
      'field.sourcePlaceholder': '可选，例如保存时所在的网页',
      'field.content': '正文',
      'field.contentPlaceholder': '粘贴或输入提示词原文',
      'field.requires': '依赖（技能 / 插件）',
      'field.requiresPlaceholder': '例如 skill:archify, plugin:dsh-wechat-md',
      'req.skill': '技能',
      'req.plugin': '插件',
      'req.missing': '未安装',
      'req.missingHint': '没有检测到它，先安装再使用这条提示词',
      'req.installHint': '点一下，让 Agent 在当前会话里安装',
      'req.installSent': '已把安装任务发给 Agent，装好后点刷新',
      'req.note': '备注',
      'editor.new': '新建提示词',
      'editor.edit': '编辑提示词',
      'import.title': '从链接智能录入',
      'import.placeholder': '粘贴链接，例如 https://example.com/article',
      'import.action': '提取提示词',
      'import.busy': '正在读取…',
      'import.hint': '抓取该页面的正文，用默认模型提取其中现成的提示词；页面没有现成提示词时，自动总结一条可复用的。',
      'import.failed': '智能录入失败',
      'import.needUrl': '先粘贴一个链接',
      'import.blank': '这个页面没有可用的提示词',
      'import.found': '找到多条，选一条填入表单',
      'import.apply': '采用',
      'import.discard': '放弃',
      'import.applied': '已填入表单，检查后保存',
      'manual.title': '手动设置',
      'manual.hint': '标题、标签、来源、正文',
      'error.copy': '复制失败，请手动选中文本复制',
      'error.emptyContent': '正文不能为空',
      'error.route': '无法连接本机提示词服务，请确认插件已启用后重试。',
      'notice.saved': '已保存',
      'notice.deleted': '已删除',
      'notice.copied': '已复制',
      'config.title': 'Agent 工具',
      'config.agentTools': '向 Agent 注册提示词工具',
      'config.agentToolsHint': '开启时注册 prompt_save、prompt_list、prompt_get、prompt_delete、prompt_import_url 五个工具；关掉后不再注册，每个请求省下这几份工具定义占用的上下文，输入框面板照常可用。',
      'config.readOnly': '当前配置在此处只读，无法修改。',
      'config.saveFailed': '保存失败，请重试。',
      'config.restartHint': '保存后需重启 DSH（或重新加载本插件）才会真正停止注册这些工具；当前会话仍按重启前的设置运行。',
    }

    const DICT_EN = {
      'trigger.label': 'Prompts',
      'trigger.hint': 'Open the prompt library to insert, copy, or manage saved prompts',
      'panel.title': 'Prompt library',
      'action.new': 'New',
      'action.refresh': 'Refresh',
      'action.close': 'Close',
      'action.retry': 'Retry',
      'action.insert': 'Insert',
      'action.copy': 'Copy',
      'action.edit': 'Edit',
      'action.delete': 'Delete',
      'action.confirmDelete': 'Delete now',
      'action.save': 'Save',
      'action.saving': 'Saving…',
      'action.cancel': 'Cancel',
      'search.label': 'Search prompts',
      'search.placeholder': 'Search titles, text, or tags',
      'tags.all': 'All',
      'tags.filter': 'Filter by tag',
      'tags.common': 'Common tags',
      'list.loading': 'Reading prompts…',
      'list.empty': 'No prompts yet. Create one, or ask the Agent to save one with the prompt tools.',
      'list.noMatch': 'No prompt matches',
      'card.untagged': 'Untagged',
      'card.chars': 'chars',
      'card.source': 'Source',
      'field.title': 'Title',
      'field.titlePlaceholder': 'Empty uses the first line of the text',
      'field.tags': 'Tags',
      'field.tagsPlaceholder': 'Comma separated, for example: architecture, codex',
      'field.source': 'Source link',
      'field.sourcePlaceholder': 'Optional, such as the page it came from',
      'field.content': 'Prompt text',
      'field.contentPlaceholder': 'Paste or type the prompt',
      'field.requires': 'Requires (skill / plugin)',
      'field.requiresPlaceholder': 'for example skill:archify, plugin:dsh-wechat-md',
      'req.skill': 'skill',
      'req.plugin': 'plugin',
      'req.missing': 'missing',
      'req.missingHint': 'Not installed; install it before using this prompt',
      'req.installHint': 'Click to have the Agent install it in this session',
      'req.installSent': 'Asked the Agent to install it; refresh when it finishes',
      'req.note': 'note',
      'editor.new': 'New prompt',
      'editor.edit': 'Edit prompt',
      'import.title': 'Smart import from a link',
      'import.placeholder': 'Paste a link, for example https://example.com/article',
      'import.action': 'Extract prompts',
      'import.busy': 'Reading…',
      'import.hint': 'Fetches the page text and asks the default model for the prompts it already contains, or writes one reusable prompt when the page has none.',
      'import.failed': 'Import failed',
      'import.needUrl': 'Paste a link first',
      'import.blank': 'No usable prompt was found on that page',
      'import.found': 'Several prompts found; pick one to fill the form',
      'import.apply': 'Use this',
      'import.discard': 'Discard',
      'import.applied': 'Filled into the form; review, then save',
      'manual.title': 'Manual fields',
      'manual.hint': 'Title, tags, source, text',
      'error.copy': 'Copy failed; select the text and copy it manually',
      'error.emptyContent': 'The prompt text cannot be empty',
      'error.route': 'Cannot reach the local prompt service. Check that the plugin is enabled, then retry.',
      'notice.saved': 'Saved',
      'notice.deleted': 'Deleted',
      'notice.copied': 'Copied',
      'config.title': 'Agent tools',
      'config.agentTools': 'Register the prompt tools to the Agent',
      'config.agentToolsHint': 'When on, the five tools prompt_save, prompt_list, prompt_get, prompt_delete, and prompt_import_url are registered to the Agent. When off they are not registered, saving their tool-definition context on every request; the composer panel keeps working.',
      'config.readOnly': 'This setting is read-only here and cannot be changed.',
      'config.saveFailed': 'Saving failed. Please try again.',
      'config.restartHint': 'Saving only takes effect after DSH restarts (or this plugin reloads): the current session keeps running with the setting from before the restart.',
    }

    /** Bound in `apply`; components prefer the slot-provided `t` and fall back to this. */
    let translate = key => key

    const ui = {
      open: false,
      view: 'list',
      prompts: [],
      query: '',
      filterTag: '',
      loading: false,
      error: '',
      editing: null,
      target: null,
      busy: false,
      notice: '',
    }
    const listeners = new Set()
    let lastFocus = null

    function emit() {
      for (const listener of listeners) listener()
    }
    function setUi(next) {
      Object.assign(ui, next)
      emit()
    }
    function subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }
    function useUi(selector) {
      return React.useSyncExternalStore(subscribe, () => selector(ui))
    }

    function messageOf(error) {
      return error instanceof Error && error.message !== '' ? error.message : String(error)
    }

    function carrier() {
      const transport = globalThis.__DSH_TRANSPORT__
      return transport !== null && typeof transport === 'object' && typeof transport.fetch === 'function'
        ? transport.fetch.bind(transport)
        : undefined
    }

    /** One JSON round trip with the Host half; the route answers failures as `{ ok: false, error }`. */
    async function callHost(method, body) {
      const url = new URL(ROUTE, document.baseURI)
      if (currentSessionId !== null) url.searchParams.set('sessionId', currentSessionId)
      const doFetch = carrier()
      const init = { method, headers: {} }
      if (body !== undefined) {
        init.headers['content-type'] = 'application/json'
        init.body = JSON.stringify(currentSessionId === null ? body : { ...body, sessionId: currentSessionId })
      }
      let response
      try {
        response = doFetch === undefined ? await fetch(url, init) : await doFetch(url.href, init)
      } catch (error) {
        throw new Error(`${translate('error.route')} (${messageOf(error)})`)
      }
      const text = await response.text()
      let payload
      try {
        payload = JSON.parse(text)
      } catch {
        throw new Error(`${translate('error.route')} (HTTP ${response.status})`)
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(typeof payload.error === 'string' && payload.error !== ''
          ? payload.error
          : `${translate('error.route')} (HTTP ${response.status})`)
      }
      return payload
    }

    /** Installed skills and profile bundles, fetched once and reused by every editor. */
    let depCatalog = null
    let depCatalogSession = null
    /** The session whose project skills the panel should check; set by the docked seat. */
    let currentSessionId = null

    function depCatalogFresh() {
      return depCatalog !== null && depCatalogSession === currentSessionId
    }

    async function loadDependencies() {
      if (depCatalogFresh()) return depCatalog
      const payload = await callHost('POST', { action: 'deps' })
      depCatalog = {
        skills: Array.isArray(payload.skills) ? payload.skills : [],
        plugins: Array.isArray(payload.plugins) ? payload.plugins : [],
      }
      depCatalogSession = currentSessionId
      return depCatalog
    }

    async function refresh() {
      setUi({ loading: true, error: '' })
      try {
        const payload = await callHost('GET')
        setUi({ prompts: Array.isArray(payload.prompts) ? payload.prompts : [], loading: false })
      } catch (error) {
        setUi({ loading: false, error: messageOf(error) })
      }
    }

    async function savePrompt(prompt) {
      setUi({ busy: true, error: '' })
      try {
        const payload = await callHost('POST', { action: 'save', prompt })
        setUi({
          prompts: Array.isArray(payload.prompts) ? payload.prompts : ui.prompts,
          busy: false,
          view: 'list',
          editing: null,
          query: '',
          filterTag: '',
          notice: translate('notice.saved'),
        })
        return true
      } catch (error) {
        setUi({ busy: false, error: messageOf(error) })
        return false
      }
    }

    async function deletePrompt(id) {
      setUi({ busy: true, error: '' })
      try {
        const payload = await callHost('POST', { action: 'delete', id })
        setUi({
          prompts: Array.isArray(payload.prompts) ? payload.prompts : ui.prompts,
          busy: false,
          notice: translate('notice.deleted'),
        })
      } catch (error) {
        setUi({ busy: false, error: messageOf(error) })
      }
    }

    function openLibrary(target) {
      lastFocus = document.activeElement
      setUi({
        open: true,
        view: 'list',
        editing: null,
        notice: '',
        query: '',
        filterTag: '',
        error: '',
        target: target === undefined ? null : target,
      })
      refresh()
    }

    function closeLibrary() {
      const restore = lastFocus
      lastFocus = null
      setUi({ open: false, editing: null, target: null })
      if (restore !== null && typeof restore.focus === 'function') window.setTimeout(() => restore.focus(), 20)
    }

    function blankPrompt() {
      return { id: '', title: '', content: '', tags: '', source: '', requires: '' }
    }

    /** Prefer caret insertion; fall back to the whole draft when the editor refuses it. The dialog closes so the composer shows the result. */
    function insertPrompt(prompt) {
      const target = ui.target
      if (target === null || target === undefined || target.actions === null || target.actions === undefined) {
        void copyPrompt(prompt)
        return
      }
      const actions = target.actions
      try {
        if (typeof actions.captureInsertion === 'function' && typeof actions.insertText === 'function') {
          const span = actions.captureInsertion()
          if (actions.insertText(prompt.content, span)) {
            closeLibrary()
            return
          }
        }
      } catch {
        // Fall through to replacing the draft.
      }
      try {
        const base = typeof target.draft === 'string' ? target.draft.trimEnd() : ''
        actions.setDraft(base === '' ? prompt.content : `${base}\n\n${prompt.content}`)
        closeLibrary()
      } catch (error) {
        setUi({ error: messageOf(error) })
      }
    }

    async function copyPrompt(prompt) {
      try {
        await navigator.clipboard.writeText(prompt.content)
        setUi({ notice: translate('notice.copied') })
        return
      } catch {
        // Fall back to a selection-based copy for pages without the async clipboard.
      }
      const holder = document.createElement('textarea')
      holder.value = prompt.content
      holder.setAttribute('readonly', 'readonly')
      holder.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;'
      document.body.appendChild(holder)
      holder.select()
      let copied = false
      try {
        copied = document.execCommand('copy')
      } catch {
        copied = false
      }
      holder.remove()
      setUi(copied ? { notice: translate('notice.copied') } : { error: translate('error.copy') })
    }

    function requirementLabel(req, t) {
      if (req.kind === 'skill') return `${t('req.skill')} ${req.name}`
      if (req.kind === 'plugin') return `${t('req.plugin')} ${req.name}`
      return req.name
    }

    function previewOf(item) {
      const source = String(item.preview ?? '') !== '' ? String(item.preview) : String(item.content ?? '')
      const single = source.replace(/\s+/g, ' ').trim()
      return single.length > 160 ? `${single.slice(0, 159)}…` : single
    }

    /** Only http(s) links are rendered as links; anything else stays plain text. */
    function safeSource(value) {
      const text = typeof value === 'string' ? value.trim() : ''
      return /^https?:\/\//i.test(text) ? text : ''
    }

    function LibraryIcon(props) {
      const size = props && props.size ? props.size : 16
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', 'aria-hidden': true,
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('rect', { x: 3.5, y: 4.5, width: 11, height: 15, rx: 2 }),
      h('path', { d: 'M7 8.5h4M7 12h4M7 15.5h2' }),
      h('path', { d: 'M18.5 6.6v11.2a2 2 0 0 1-1.5 1.9l-1.6.4' }))
    }

    function CloseIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': true,
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
      }, h('path', { d: 'M3.5 3.5l9 9M12.5 3.5l-9 9' }))
    }

    function RefreshIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': true,
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('path', { d: 'M13 8a5 5 0 1 1-1.6-3.7' }),
      h('path', { d: 'M13 2.6V8h-5' }))
    }

    function WandIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 12, height: 12, fill: 'none', 'aria-hidden': true,
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('path', { d: 'M9.6 2.4l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z' }),
      h('path', { d: 'M3.4 9.4l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z' }),
      h('path', { d: 'M11.2 10.6v2.8' }))
    }

    function InstallIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 10, height: 10, fill: 'none', 'aria-hidden': true,
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('path', { d: 'M8 3v6.2' }),
      h('path', { d: 'M5.4 6.8L8 9.4l2.6-2.6' }),
      h('path', { d: 'M3.4 12.4h9.2' }))
    }

    function ChevronIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 12, height: 12, fill: 'none', 'aria-hidden': true,
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
      }, h('path', { d: 'M6 3.5l4.5 4.5L6 12.5' }))
    }

    function trOf(props) {
      return typeof props.t === 'function' ? props.t : translate
    }

    /** Composer tool-row chip: the click captures this session's input actions. */
    function ComposerTrigger(props) {
      const t = trOf(props)
      const draft = props.useInput(state => state.draft)
      return h('button', {
        type: 'button',
        className: 'plib-chip',
        'data-plib-trigger': 'composer',
        title: t('trigger.hint'),
        'aria-label': t('trigger.label'),
        onClick: () => openLibrary({ actions: props.inputActions, draft, sessionId: props.sessionId }),
      }, h(LibraryIcon, { size: 15 }), h('span', { className: 'plib-chip-label' }, t('trigger.label')))
    }

    /** The only seat: docked above the composer card, tracking the session it belongs to. */
    function DockPanel(props) {
      const open = useUi(state => state.open)
      React.useEffect(() => {
        currentSessionId = props.sessionId === undefined ? null : props.sessionId
        return () => { currentSessionId = null }
      }, [props.sessionId])
      if (!open) return null
      return h(Dialog, { t: trOf(props), sessionId: props.sessionId })
    }

    function Dialog(props) {
      const t = props.t
      const sessionId = props.sessionId
      const prompts = useUi(state => state.prompts)
      const query = useUi(state => state.query)
      const filterTag = useUi(state => state.filterTag)
      const loading = useUi(state => state.loading)
      const error = useUi(state => state.error)
      const view = useUi(state => state.view)
      const editing = useUi(state => state.editing)
      const notice = useUi(state => state.notice)
      const busy = useUi(state => state.busy)
      const canInsert = useUi(state => state.target !== null
        && state.target !== undefined
        && state.target.sessionId === sessionId)
      const searchRef = React.useRef(null)
      const panelRef = React.useRef(null)

      React.useEffect(() => {
        if (searchRef.current !== null && typeof searchRef.current.focus === 'function') searchRef.current.focus()
      }, [view])

      React.useEffect(() => {
        function onKeyDown(event) {
          if (event.isComposing) return
          if (event.key === 'Escape') {
            event.stopPropagation()
            if (ui.view === 'edit') setUi({ view: 'list', editing: null, error: '' })
            else closeLibrary()
            return
          }
          if (event.key !== 'Tab' || panelRef.current === null) return
          const nodes = panelRef.current.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]')
          if (nodes.length === 0) return
          const first = nodes[0]
          const last = nodes[nodes.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
      }, [])

      React.useEffect(() => {
        if (notice === '') return undefined
        const timer = window.setTimeout(() => setUi({ notice: '' }), 2400)
        return () => window.clearTimeout(timer)
      }, [notice])

      // No backdrop: a click anywhere outside closes the panel.
      React.useEffect(() => {
        function onPointerDown(event) {
          const panel = panelRef.current
          if (panel === null) return
          if (panel.contains(event.target)) return
          if (typeof event.target.closest === 'function' && event.target.closest('[data-plib-trigger]') !== null) return
          closeLibrary()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => document.removeEventListener('pointerdown', onPointerDown, true)
      }, [])

      const needle = query.trim().toLowerCase()
      const visible = prompts.filter(item => {
        const tags = Array.isArray(item.tags) ? item.tags : []
        if (filterTag !== '' && !tags.includes(filterTag)) return false
        if (needle === '') return true
        return `${item.title}\n${item.content}\n${tags.join(' ')}`.toLowerCase().includes(needle)
      })
      const tagCounts = React.useMemo(() => {
        const counts = new Map()
        for (const item of prompts) {
          for (const tag of (Array.isArray(item.tags) ? item.tags : [])) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1)
          }
        }
        return Array.from(counts.entries())
          .sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1))
          .slice(0, 12)
          .map(([tag]) => tag)
      }, [prompts])

      // A filter whose last entry disappeared would leave an empty list with no active chip.
      React.useEffect(() => {
        if (ui.filterTag !== '' && !tagCounts.includes(ui.filterTag)) setUi({ filterTag: '' })
      }, [tagCounts])

      const search = h('div', { className: 'plib-search' },
        h('div', { className: 'plib-search-row' },
          h('input', {
            ref: searchRef,
            className: 'plib-input',
            type: 'search',
            value: query,
            placeholder: t('search.placeholder'),
            'aria-label': t('search.label'),
            onChange: event => setUi({ query: event.target.value }),
          }),
          h('button', {
            type: 'button', className: 'plib-icon-btn', 'aria-label': t('action.refresh'), title: t('action.refresh'),
            onClick: refresh,
          }, h(RefreshIcon)),
          h('button', {
            type: 'button', className: 'plib-btn',
            onClick: () => setUi({ view: 'edit', editing: blankPrompt(), error: '' }),
          }, t('action.new')),
          h('button', {
            type: 'button', className: 'plib-icon-btn', 'aria-label': t('action.close'), title: t('action.close'),
            onClick: closeLibrary,
          }, h(CloseIcon))),
        tagCounts.length === 0
          ? null
          : h('div', { className: 'plib-tags', role: 'group', 'aria-label': t('tags.filter') },
            h('button', {
              type: 'button', className: 'plib-tag', 'data-active': filterTag === '',
              'aria-pressed': filterTag === '', onClick: () => setUi({ filterTag: '' }),
            }, t('tags.all')),
            tagCounts.map(tag => h('button', {
              key: tag,
              type: 'button',
              className: 'plib-tag',
              'data-active': filterTag === tag,
              'aria-pressed': filterTag === tag,
              onClick: () => setUi({ filterTag: filterTag === tag ? '' : tag }),
            }, tag))))

      const status = error !== ''
        ? h('div', { className: 'plib-note plib-note-error', role: 'alert' },
          h('span', null, error),
          h('button', { type: 'button', className: 'plib-btn', onClick: refresh }, t('action.retry')))
        : null

      const list = h('div', { className: 'plib-list' },
        loading ? h('div', { className: 'plib-empty' }, t('list.loading')) : null,
        !loading && error === '' && visible.length === 0
          ? h('div', { className: 'plib-empty' },
            h('p', null, prompts.length === 0 ? t('list.empty') : t('list.noMatch')),
            h('button', {
              type: 'button', className: 'plib-btn', 'data-primary': 'true',
              onClick: () => setUi({ view: 'edit', editing: blankPrompt(), error: '' }),
            }, t('action.new')))
          : null,
        visible.map(item => h(Card, { key: item.id, item, t, busy, canInsert })))

      const listView = h('div', { className: 'plib-body' }, search, status, list)

      const editorView = view === 'edit'
        ? h(Editor, {
          key: editing && editing.id ? editing.id : 'new',
          t,
          editing: editing || blankPrompt(),
          busy,
          error,
          knownTags: tagCounts,
        })
        : null

      const panel = h('div', {
        className: 'plib-panel',
        role: 'dialog',
        'aria-label': t('panel.title'),
        ref: panelRef,
      },
      view === 'edit'
        ? h('div', { className: 'plib-head plib-head-edit' },
          h('span', { className: 'plib-title' }, editing && editing.id ? t('editor.edit') : t('editor.new')),
          h('span', { className: 'plib-spacer' }),
          h('button', {
            type: 'button', className: 'plib-icon-btn', 'aria-label': t('action.close'), title: t('action.close'),
            onClick: closeLibrary,
          }, h(CloseIcon)))
        : null,
      view === 'edit' ? editorView : listView,
      notice === '' ? null : h('div', { className: 'plib-toast', 'aria-hidden': 'true' }, notice),
      h('div', { className: 'plib-sr', role: 'status', 'aria-live': 'polite' }, notice))

      return h('div', { className: 'plib-dock' }, panel)
    }

    function Card(props) {
      const { item, t, busy, canInsert } = props
      const [confirming, setConfirming] = React.useState(false)
      const [armed, setArmed] = React.useState(false)
      const [installing, setInstalling] = React.useState('')

      React.useEffect(() => {
        if (!confirming) {
          setArmed(false)
          return undefined
        }
        const arm = window.setTimeout(() => setArmed(true), 400)
        const reset = window.setTimeout(() => setConfirming(false), 3200)
        return () => {
          window.clearTimeout(arm)
          window.clearTimeout(reset)
        }
      }, [confirming])

      const tags = Array.isArray(item.tags) ? item.tags : []
      const requirements = Array.isArray(item.requirements) ? item.requirements : []
      const meta = `${tags.length > 0 ? tags.join(' · ') : t('card.untagged')} · ${String(item.content ?? '').length} ${t('card.chars')}`
      const source = safeSource(item.source)
      const runInstall = async (req) => {
        setInstalling(req.raw)
        try {
          await callHost('POST', {
            action: 'install',
            raw: req.raw,
            title: item.title,
            source: item.source || '',
          })
          setUi({ notice: t('req.installSent') })
        } catch (error) {
          setUi({ error: messageOf(error) })
        } finally {
          setInstalling('')
        }
      }

      const openEditor = () => setUi({
        view: 'edit',
        error: '',
        editing: {
          id: item.id,
          title: item.title,
          content: item.content,
          tags: tags.join(', '),
          source: item.source || '',
          requires: Array.isArray(item.requires) ? item.requires.join(', ') : '',
        },
      })

      return h('article', { className: 'plib-card' },
        h('div', { className: 'plib-card-head' },
          h('h3', { className: 'plib-card-title', title: item.title }, item.title),
          source !== ''
            ? h('a', {
              className: 'plib-card-source', href: source, target: '_blank', rel: 'noreferrer',
            }, t('card.source'))
            : null),
        h('p', { className: 'plib-card-preview' }, previewOf(item)),
        h('div', { className: 'plib-card-meta' }, meta),
        requirements.length === 0
          ? null
          : h('div', { className: 'plib-reqs' }, requirements.map((req) => {
            const label = requirementLabel(req, t)
            if (req.status !== 'missing') {
              return h('span', { key: req.raw, className: 'plib-req', 'data-status': req.status, title: req.raw }, label)
            }
            return h('button', {
              key: req.raw,
              type: 'button',
              className: 'plib-req plib-req-action',
              'data-status': 'missing',
              title: `${t('req.missingHint')} · ${t('req.installHint')}`,
              'aria-label': `${label} · ${t('req.installHint')}`,
              disabled: installing === req.raw,
              onClick: () => { void runInstall(req) },
            }, `${label} · ${t('req.missing')}`, h(InstallIcon))
          })),
        h('div', { className: 'plib-card-actions' },
          canInsert
            ? h('button', {
              type: 'button', className: 'plib-btn', 'data-primary': 'true',
              onClick: () => insertPrompt(item),
            }, t('action.insert'))
            : null,
          h('button', { type: 'button', className: 'plib-btn', onClick: () => { void copyPrompt(item) } }, t('action.copy')),
          h('button', { type: 'button', className: 'plib-btn', onClick: openEditor }, t('action.edit')),
          confirming
            ? h('button', {
              type: 'button', className: 'plib-btn plib-danger', disabled: busy || !armed,
              onClick: () => { setConfirming(false); void deletePrompt(item.id) },
            }, t('action.confirmDelete'))
            : h('button', {
              type: 'button', className: 'plib-btn plib-quiet-danger',
              onClick: () => setConfirming(true),
            }, t('action.delete'))))
    }

    /** Tags typed as text; chips add and remove entries in the same string. */
    function splitTags(value) {
      return value.split(/[,，、]/).map(entry => entry.trim()).filter(entry => entry !== '')
    }

    function Editor(props) {
      const { t, editing, busy, error } = props
      const knownTags = Array.isArray(props.knownTags) ? props.knownTags : []
      const [title, setTitle] = React.useState(editing.title || '')
      const [content, setContent] = React.useState(editing.content || '')
      const [tags, setTags] = React.useState(editing.tags || '')
      const [requiresText, setRequiresText] = React.useState(editing.requires || '')
      const [deps, setDeps] = React.useState(depCatalog)
      const [source, setSource] = React.useState(editing.source || '')
      const [localError, setLocalError] = React.useState('')
      const [importUrl, setImportUrl] = React.useState(editing.source || '')
      const [importing, setImporting] = React.useState(false)
      const [importError, setImportError] = React.useState('')
      const [candidates, setCandidates] = React.useState([])
      const [applied, setApplied] = React.useState('')
      // A new prompt starts as smart-import only; editing an entry needs its fields.
      const [manualOpen, setManualOpen] = React.useState(Boolean(editing.id))
      const contentRef = React.useRef(null)
      const chosen = splitTags(tags)
      const required = splitTags(requiresText)
      const hasTag = tag => chosen.some(entry => entry.toLowerCase() === tag.toLowerCase())
      const hasRequire = raw => required.some(entry => entry.toLowerCase() === raw.toLowerCase())
      const toggleRequire = (raw) => {
        const next = hasRequire(raw)
          ? required.filter(entry => entry.toLowerCase() !== raw.toLowerCase())
          : [...required, raw]
        setRequiresText(next.join(', '))
      }
      const toggleTag = tag => {
        const next = hasTag(tag)
          ? chosen.filter(entry => entry.toLowerCase() !== tag.toLowerCase())
          : [...chosen, tag]
        setTags(next.join(', '))
      }

      React.useEffect(() => {
        if (contentRef.current !== null && typeof contentRef.current.focus === 'function') contentRef.current.focus()
      }, [])

      React.useEffect(() => {
        let alive = true
        if (depCatalogFresh()) {
          setDeps(depCatalog)
          return () => { alive = false }
        }
        loadDependencies().then(
          next => { if (alive) setDeps(next) },
          () => { if (alive) setDeps({ skills: [], plugins: [] }) },
        )
        return () => { alive = false }
      }, [])

      /** Fill the form from one candidate; the user still saves it explicitly. */
      const applyCandidate = (candidate, sourceUrl) => {
        setTitle(typeof candidate.title === 'string' ? candidate.title : '')
        setContent(typeof candidate.content === 'string' ? candidate.content : '')
        setTags(Array.isArray(candidate.tags) ? candidate.tags.join(', ') : '')
        const origin = (sourceUrl || importUrl).trim()
        if (origin !== '') setSource(origin)
        setCandidates([])
        setImportError('')
        setManualOpen(true)
        setApplied(t('import.applied'))
      }

      const runImport = async () => {
        const url = importUrl.trim()
        if (url === '') {
          setImportError(t('import.needUrl'))
          return
        }
        setImporting(true)
        setImportError('')
        setApplied('')
        setCandidates([])
        try {
          const payload = await callHost('POST', { action: 'import', url })
          const found = Array.isArray(payload.prompts) ? payload.prompts : []
          if (found.length === 0) setImportError(t('import.blank'))
          else if (found.length === 1) applyCandidate(found[0], url)
          else setCandidates(found)
        } catch (error) {
          setImportError(`${t('import.failed')}: ${messageOf(error)}`)
        } finally {
          setImporting(false)
        }
      }

      const submit = () => {
        if (content.trim() === '') {
          setManualOpen(true)
          setLocalError(t('error.emptyContent'))
          return
        }
        setLocalError('')
        void savePrompt({
          id: editing.id || undefined,
          title,
          content,
          tags: splitTags(tags),
          requires: splitTags(requiresText),
          source,
        })
      }

      const cancel = () => setUi({ view: 'list', editing: null, error: '' })
      const shownError = localError !== '' ? localError : error

      return h('div', { className: 'plib-body plib-edit' },
        shownError === ''
          ? null
          : h('div', { className: 'plib-note plib-note-error', role: 'alert' }, shownError),
        h('div', { className: 'plib-import' },
          h('div', { className: 'plib-import-head' }, h(WandIcon), h('span', null, t('import.title'))),
          h('div', { className: 'plib-import-row' },
            h('input', {
              className: 'plib-input', type: 'url', value: importUrl,
              placeholder: t('import.placeholder'), 'aria-label': t('import.title'),
              onChange: event => setImportUrl(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter' && !importing) {
                  event.preventDefault()
                  void runImport()
                }
              },
            }),
            h('button', {
              type: 'button', className: 'plib-btn', 'data-primary': 'true',
              disabled: importing, onClick: () => { void runImport() },
            }, importing ? t('import.busy') : t('import.action'))),
          h('p', { className: 'plib-import-hint' }, t('import.hint')),
          importError === ''
            ? null
            : h('p', { className: 'plib-import-error', role: 'alert' }, importError),
          applied === ''
            ? null
            : h('p', { className: 'plib-import-note', role: 'status' }, applied),
          candidates.length === 0
            ? null
            : h('div', { className: 'plib-candidates' },
              h('div', { className: 'plib-candidates-head' },
                h('span', null, t('import.found')),
                h('button', { type: 'button', className: 'plib-btn', onClick: () => setCandidates([]) }, t('import.discard'))),
              candidates.map((candidate, index) => h('div', { key: index, className: 'plib-candidate' },
                h('div', { className: 'plib-candidate-head' },
                  h('strong', { className: 'plib-candidate-title' }, candidate.title),
                  h('button', {
                    type: 'button', className: 'plib-btn',
                    onClick: () => applyCandidate(candidate),
                  }, t('import.apply'))),
                h('p', { className: 'plib-candidate-preview' }, previewOf({ content: candidate.content })))))),
        h('button', {
          type: 'button',
          className: 'plib-disclosure',
          'data-open': manualOpen,
          'aria-expanded': manualOpen,
          onClick: () => setManualOpen(value => !value),
        },
        h(ChevronIcon),
        h('span', { className: 'plib-disclosure-label' }, t('manual.title')),
        h('span', { className: 'plib-disclosure-hint' }, t('manual.hint'))),
        manualOpen
          ? h('div', { className: 'plib-manual' },
            h('label', { className: 'plib-field' },
              h('span', { className: 'plib-label' }, t('field.title')),
              h('input', {
                className: 'plib-input', type: 'text', value: title, placeholder: t('field.titlePlaceholder'),
                onChange: event => setTitle(event.target.value),
              })),
            h('div', { className: 'plib-field' },
              h('span', { className: 'plib-label' }, t('field.tags')),
              knownTags.length === 0
                ? null
                : h('div', { className: 'plib-tags', role: 'group', 'aria-label': t('tags.common') },
                  knownTags.map(tag => h('button', {
                    key: tag,
                    type: 'button',
                    className: 'plib-tag',
                    'data-active': hasTag(tag),
                    'aria-pressed': hasTag(tag),
                    onClick: () => toggleTag(tag),
                  }, tag))),
              h('input', {
                className: 'plib-input', type: 'text', value: tags, placeholder: t('field.tagsPlaceholder'),
                'aria-label': t('field.tags'),
                onChange: event => setTags(event.target.value),
              })),
            h('div', { className: 'plib-field' },
              h('span', { className: 'plib-label' }, t('field.requires')),
              deps === null || (deps.skills.length === 0 && deps.plugins.length === 0)
                ? null
                : h('div', { className: 'plib-tags', role: 'group', 'aria-label': t('field.requires') },
                  deps.skills.slice(0, 8).map(name => h('button', {
                    key: `skill:${name}`,
                    type: 'button',
                    className: 'plib-tag',
                    'data-active': hasRequire(`skill:${name}`),
                    'aria-pressed': hasRequire(`skill:${name}`),
                    onClick: () => toggleRequire(`skill:${name}`),
                  }, `${t('req.skill')} ${name}`)),
                  deps.plugins.slice(0, 8).map(name => h('button', {
                    key: `plugin:${name}`,
                    type: 'button',
                    className: 'plib-tag',
                    'data-active': hasRequire(`plugin:${name}`),
                    'aria-pressed': hasRequire(`plugin:${name}`),
                    onClick: () => toggleRequire(`plugin:${name}`),
                  }, `${t('req.plugin')} ${name}`))),
              h('input', {
                className: 'plib-input', type: 'text', value: requiresText,
                placeholder: t('field.requiresPlaceholder'), 'aria-label': t('field.requires'),
                onChange: event => setRequiresText(event.target.value),
              })),
            h('label', { className: 'plib-field' },
              h('span', { className: 'plib-label' }, t('field.source')),
              h('input', {
                className: 'plib-input', type: 'url', value: source, placeholder: t('field.sourcePlaceholder'),
                onChange: event => setSource(event.target.value),
              })),
            h('label', { className: 'plib-field plib-field-grow' },
              h('span', { className: 'plib-label' }, t('field.content')),
              h('textarea', {
                ref: contentRef,
                className: 'plib-textarea', value: content, placeholder: t('field.contentPlaceholder'),
                onChange: event => setContent(event.target.value),
              })),
          )
          : null,
        h('div', { className: 'plib-row' },
          h('button', { type: 'button', className: 'plib-btn', onClick: cancel, disabled: busy }, t('action.cancel')),
          h('button', {
            type: 'button', className: 'plib-btn', 'data-primary': 'true', onClick: submit, disabled: busy,
          }, busy ? t('action.saving') : t('action.save'))))
    }

    /** The settings snapshot holds agentTools; anything but an explicit `false` is the default (on). */
    function agentToolsOn(form) {
      return (form && form.value && form.value.agentTools) !== false
    }

    /**
     * The `plugins.bundle.config` card for this package: one switch for `agentTools`, on the bundle's page in the
     * plugin manager. Owner props: `view`; inject: `useSettingsForm` (the entry's settings form), `setAgentTools`.
     */
    function AgentToolsSettings(props) {
      const t = trOf(props)
      const form = props.useSettingsForm(value => value)
      const [saving, setSaving] = React.useState(false)
      const [failed, setFailed] = React.useState(false)
      if (props.view !== 'page' || form.status === 'unavailable') return null
      const ready = form.status === 'ready'
      return h('div', { className: 'plib-settings' },
        h('h4', { className: 'plib-settings-title' }, t('config.title')),
        h('div', { className: 'plib-settings-row' },
          h('div', { className: 'plib-settings-text' },
            h('div', { className: 'plib-settings-label' }, t('config.agentTools')),
            h('p', { className: 'plib-settings-hint' }, t('config.agentToolsHint'))),
          h(primitives.Switch, {
            checked: agentToolsOn(form),
            label: t('config.agentTools'),
            disabled: !ready || !form.writable || saving,
            onChange(next) {
              setSaving(true)
              setFailed(false)
              Promise.resolve(props.setAgentTools(next)).then(
                accepted => { setSaving(false); setFailed(accepted === false) },
                () => { setSaving(false); setFailed(true) })
            },
          })),
        h('p', { className: 'plib-settings-hint plib-settings-restart' }, t('config.restartHint')),
        ready && !form.writable ? h('p', { className: 'plib-settings-hint' }, t('config.readOnly')) : null,
        failed ? h('p', { className: 'plib-settings-error', role: 'alert' }, t('config.saveFailed')) : null)
    }

    const CSS = `
.plib-chip{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 8px;border:1px solid transparent;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap}
.plib-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.plib-chip:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
/* Docked seat: absolute child of the composer's zero-height overlay anchor, so
   the panel's left edge and width follow the input card and it grows upward. */
.plib-dock{position:absolute;left:12px;right:12px;bottom:6px;z-index:2}
.plib-dock .plib-panel{width:100%;max-height:50vh}
.plib-dock .plib-textarea{min-height:132px}
.plib-panel{position:relative;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,16px);box-shadow:0 18px 48px rgba(0,0,0,.24);overflow:hidden}
.plib-head{display:flex;align-items:center;gap:10px;flex:none;min-height:50px;padding:12px 16px;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l1)}
.plib-head-edit{min-height:42px;padding:8px 16px}
.plib-title{display:flex;align-items:center;gap:8px;flex:none;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap}
.plib-title svg{color:var(--dsw-alias-state-business-primary)}
.plib-spacer{flex:1}
.plib-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.plib-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.plib-icon-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.plib-body{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.plib-search{flex:none;display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.plib-search-row{display:flex;align-items:center;gap:6px}
.plib-search-row .plib-input{flex:1;min-width:0}
.plib-tags{display:flex;flex-wrap:wrap;gap:6px}
.plib-search .plib-tags{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:1px}
.plib-search .plib-tags::-webkit-scrollbar{display:none}
.plib-tag{height:22px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:11px;line-height:1;cursor:pointer;white-space:nowrap}
.plib-tag:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.plib-tag[data-active="true"]{border-color:transparent;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-brand-text)}
.plib-tag:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.plib-input{width:100%;height:32px;padding:0 10px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px}
.plib-input::placeholder,.plib-textarea::placeholder{color:var(--dsw-alias-label-secondary)}
.plib-input:focus-visible,.plib-textarea:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.plib-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:12px 16px;scrollbar-width:thin}
.plib-card{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);padding:10px 12px}
.plib-card-head{display:flex;align-items:baseline;gap:8px}
.plib-card-title{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.plib-card-source{flex:none;font-size:11px;color:var(--dsw-alias-link);text-decoration:none}
.plib-card-source:hover{text-decoration:underline}
.plib-card-preview{margin:4px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.plib-card-meta{margin-top:6px;font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.plib-reqs{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.plib-req{display:inline-flex;align-items:center;height:18px;padding:0 7px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;font-size:10px;line-height:1;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.plib-req[data-status="missing"]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.plib-req svg{flex:none;margin-left:4px}
.plib-req-action{cursor:pointer;font-family:inherit}
.plib-req-action:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}
.plib-req-action:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.plib-req-action:disabled{opacity:.6;cursor:default}
.plib-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.plib-btn{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.plib-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.plib-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.plib-btn:disabled{opacity:.5;cursor:default}
.plib-btn[data-primary="true"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
.plib-btn[data-primary="true"]:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary))}
.plib-quiet-danger{color:var(--dsw-alias-state-error-primary)}
.plib-danger{background:transparent;border-color:currentColor;color:var(--dsw-alias-state-error-primary)}
.plib-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}
.plib-note{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:none;padding:8px 16px;font-size:12px;line-height:1.5}
.plib-note-error{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1)}
.plib-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:36px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.7}
.plib-empty p{margin:0;max-width:46ch}
.plib-import{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2)}
.plib-import-head{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.plib-import-head svg{color:var(--dsw-alias-state-business-primary)}
.plib-import-row{display:flex;align-items:center;gap:6px}
.plib-import-row .plib-input{flex:1;min-width:0}
.plib-import-hint{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.plib-import-error{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-state-error-primary);word-break:break-word}
.plib-import-note{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-state-success-primary)}
.plib-candidates{display:flex;flex-direction:column;gap:6px}
.plib-candidates-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.plib-candidate{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,6px);padding:8px;background:var(--dsw-alias-bg-base)}
.plib-candidate-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.plib-candidate-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.plib-candidate-preview{margin:4px 0 0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.plib-disclosure{display:flex;align-items:center;gap:6px;padding:2px;border:none;background:transparent;font-family:inherit;font-size:12px;cursor:pointer;text-align:left;color:var(--dsw-alias-label-secondary)}
.plib-disclosure:hover{color:var(--dsw-alias-label-primary)}
.plib-disclosure:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.plib-disclosure svg{flex:none;transition:transform .12s ease}
.plib-disclosure[data-open="true"] svg{transform:rotate(90deg)}
.plib-disclosure-label{font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap}
.plib-disclosure-hint{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.plib-manual{display:flex;flex-direction:column;gap:10px}
.plib-edit{gap:10px;padding:14px 16px;overflow:auto}
.plib-field{display:flex;flex-direction:column;gap:4px}
.plib-field-grow{flex:1;min-height:200px}
.plib-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.plib-textarea{flex:1;min-height:200px;width:100%;padding:10px;box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;line-height:1.7;tab-size:2}
.plib-row{display:flex;justify-content:flex-end;gap:6px;flex:none}
.plib-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);max-width:calc(100% - 40px);padding:7px 13px;border-radius:8px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);font-size:12px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 24px rgba(0,0,0,.18);pointer-events:none}
.plib-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.plib-settings{display:flex;flex-direction:column;gap:8px}
.plib-settings-title{margin:0;font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary)}
.plib-settings-row{display:flex;align-items:center;gap:16px}
.plib-settings-text{flex:1 1 auto;min-width:0}
.plib-settings-label{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.plib-settings-hint{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.plib-settings-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}
@media (max-width:860px){
  .plib-dock{left:8px;right:8px}
  .plib-chip-label{display:none}
  .plib-list{padding:10px 12px}
  .plib-edit{padding:12px}
}
`

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: DICT_ZH, en: DICT_EN }), 'prompt-library: dictionaries')
        translate = ctx.locale.bind(NS)
        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-plugin', 'dsh-prompt-library')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'prompt-library: styles')

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'prompt-library',
          order: 40,
          locale: NS,
        }, ComposerTrigger))

        // Above the composer card, inside the composer column, so the panel shares the input's width and left edge.
        ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
          name: 'conversation.input.overlay',
          id: 'prompt-library',
          order: 40,
          locale: NS,
        }, DockPanel))

        // The plugin page's settings card: one switch for the Host's `agentTools` Config. Without the settings
        // forms (or the host's Switch) the default holds and nothing is shown.
        ctx.inject(['configForms'], (scope) => {
          const form = scope.configForms.get('dsh-prompt-library')
          if (!form || !primitives || typeof primitives.Switch !== 'function') return
          scope.effect(() => scope.slots.inject('plugins.bundle.config', () => scope.slots.register({
            name: 'plugins.bundle.config', key: 'dsh-prompt-library', locale: NS,
            inject() {
              return { hooks: { settingsForm: form }, setAgentTools: value => form.set('agentTools', value) }
            },
          }, AgentToolsSettings)), 'prompt-library: agent tools settings')
        })

      },
    }
  },
})
