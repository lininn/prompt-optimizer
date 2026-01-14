<template>
    <!--
        PromptOptimizerApp - 主应用组件

        职责:
        - 提供完整的 Prompt Optimizer 应用功能
        - 统一 web 和 extension 应用的核心逻辑
        - 管理所有状态、composables 和事件处理

        设计说明:
        - 从 App.vue 提取的核心逻辑
        - 减少 web/extension 应用的重复代码
    -->
    <NConfigProvider
        :theme="naiveTheme"
        :theme-overrides="themeOverrides"
        :hljs="hljsInstance"
    >
        <div v-if="isInitializing" class="loading-container">
            <div class="spinner"></div>
            <p>{{ t("log.info.initializing") }}</p>
        </div>
        <div v-else-if="!services" class="loading-container error">
            <p>{{ t("toast.error.appInitFailed") }}</p>
        </div>
        <div
            v-else-if="authState.enabled && authState.loading"
            class="loading-container"
        >
            <div class="spinner"></div>
            <p>正在获取认证配置...</p>
        </div>
        <div
            v-else-if="authBlocking"
            class="auth-wrapper"
        >
            <div class="auth-card">
                <div class="auth-header">
                    <div class="auth-logo">
                        <div class="logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>
                    <h1 class="auth-title">Prompt Optimizer</h1>
                    <p class="auth-subtitle">
                        {{ authState.mode === "login" ? "欢迎回来，请登录您的账户" : "创建新账户，开始优化您的提示词" }}
                    </p>
                </div>

                <NTabs
                    v-model:value="authState.mode"
                    type="segment"
                    animated
                    size="large"
                    class="auth-tabs"
                    @update:value="switchAuthMode"
                >
                    <NTabPane name="login" tab="登录" />
                    <NTabPane v-if="authState.allowRegistration" name="register" tab="注册" />
                </NTabs>

                <NForm
                    ref="formRef"
                    :model="authForm"
                    :rules="formRules"
                    size="large"
                    label-placement="top"
                    require-mark-placement="right-hanging"
                    class="auth-form"
                >
                    <NFormItem label="用户名" path="username">
                        <NInput
                            v-model:value="authForm.username"
                            placeholder="请输入用户名"
                            autocomplete="username"
                            clearable
                            @keyup.enter="handleSubmitAuth"
                        >
                            <template #prefix>
                                <NIcon :component="PersonOutline" />
                            </template>
                        </NInput>
                    </NFormItem>

                    <NFormItem
                        :label="authState.mode === 'register' ? '密码（至少8位，包含字母和数字）' : '密码'"
                        path="password"
                    >
                        <NInput
                            v-model:value="authForm.password"
                            type="password"
                            show-password-on="click"
                            placeholder="请输入密码"
                            autocomplete="current-password"
                            @keyup.enter="handleSubmitAuth"
                        >
                            <template #prefix>
                                <NIcon :component="LockClosedOutline" />
                            </template>
                        </NInput>
                    </NFormItem>

                    <NFormItem label="验证码" path="captcha">
                        <div class="captcha-container">
                            <NInput
                                v-model:value="authForm.captcha"
                                placeholder="请输入验证码"
                                class="captcha-input"
                                @keyup.enter="handleSubmitAuth"
                            >
                                <template #prefix>
                                    <NIcon :component="CheckmarkCircleOutline" />
                                </template>
                            </NInput>
                            <div class="captcha-image" @click="refreshCaptcha">
                                <img
                                    v-if="authState.captcha.image"
                                    :src="authState.captcha.image"
                                    alt="验证码"
                                />
                                <span v-else class="captcha-placeholder">点击刷新</span>
                            </div>
                            <NButton
                                secondary
                                :loading="authState.captcha.loading"
                                @click="refreshCaptcha"
                                class="captcha-refresh-btn"
                            >
                                <template #icon>
                                    <NIcon :component="RefreshOutline" />
                                </template>
                            </NButton>
                        </div>
                    </NFormItem>

                    <div v-if="authState.error" class="auth-error">
                        <svg class="error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <circle cx="12" cy="16" r="1" fill="currentColor"/>
                        </svg>
                        <span>{{ authState.error }}</span>
                    </div>

                    <NButton
                        type="primary"
                        size="large"
                        block
                        strong
                        :loading="authState.processing"
                        @click="handleSubmitAuth"
                        class="auth-submit"
                    >
                        {{ authState.mode === "login" ? "登录" : "注册" }}
                    </NButton>
                </NForm>
            </div>
        </div>
        <template v-else>
            <MainLayoutUI>
                <!-- Title Slot -->
                <template #title>
                    {{ t("promptOptimizer.title") }}
                </template>

                <!-- Core Navigation Slot -->
                <template #core-nav>
                    <AppCoreNav
                        :functionMode="functionMode"
                        :basicSubMode="basicSubMode"
                        :proSubMode="proSubMode"
                        :imageSubMode="imageSubMode"
                        @update:functionMode="handleModeSelect"
                        @basic-sub-mode-change="handleBasicSubModeChange"
                        @pro-sub-mode-change="handleProSubModeChange"
                        @image-sub-mode-change="handleImageSubModeChange"
                    />
                </template>

                <!-- Actions Slot -->
                <template #actions>
                    <AppHeaderActions
                        @open-templates="openTemplateManager"
                        @open-history="historyManager.showHistory = true"
                        @open-model-manager="modelManager.showConfig = true"
                        @open-favorites="showFavoriteManager = true"
                        @open-data-manager="showDataManager = true"
                        @open-github="openGithubRepo"
                    />
                </template>
                <template #main>
                    <!-- 上下文模式：根据模式使用不同的独立组件 -->
                    <template v-if="functionMode === 'pro'">
                        <!-- 上下文-系统模式 -->
                        <ContextSystemWorkspace
                            ref="systemWorkspaceRef"
                            v-if="contextMode === 'system'"
                            :optimized-reasoning="optimizer.optimizedReasoning"
                            :optimization-mode="selectedOptimizationMode"
                            :is-optimizing="optimizer.isOptimizing"
                            :is-iterating="optimizer.isIterating"
                            :selected-iterate-template="
                                optimizer.selectedIterateTemplate
                            "
                            @update:selectedIterateTemplate="
                                optimizer.selectedIterateTemplate = $event
                            "
                            :optimization-context="optimizationContext"
                            @update:optimizationContext="
                                optimizationContext = $event
                            "
                            :tool-count="optimizationContextTools.length"
                            :global-variables="
                                variableManager?.customVariables?.value || {}
                            "
                            :predefined-variables="predefinedVariables"
                            :available-variables="
                                variableManager?.variableManager.value?.resolveAllVariables() ||
                                {}
                            "
                            :scan-variables="
                                (content) =>
                                    variableManager?.variableManager.value?.scanVariablesInContent(
                                        content,
                                    ) || []
                            "
                            :input-mode="
                                responsiveLayout.recommendedInputMode.value
                            "
                            :control-bar-layout="
                                responsiveLayout.recommendedControlBarLayout
                                    .value
                            "
                            :button-size="
                                responsiveLayout.smartButtonSize.value
                            "
                            :conversation-max-height="
                                responsiveLayout.responsiveHeights.value
                                    .conversationMax
                            "
                            :result-vertical-layout="
                                responsiveLayout.isMobile.value
                            "
                            :is-compare-mode="isCompareMode"
                            @update:isCompareMode="isCompareMode = $event"
                            @compare-toggle="handleTestAreaCompareToggle"
                            @optimize="handleOptimizePrompt"
                            @iterate="handleIteratePrompt"
                            @switchVersion="handleSwitchVersion"
                            @save-favorite="handleSaveFavorite"
                            @open-global-variables="openVariableManager()"
                            @open-variable-manager="handleOpenVariableManager"
                            @open-context-editor="handleOpenContextEditor()"
                            @open-tool-manager="handleOpenToolManager"
                            @openTemplateManager="openTemplateManager"
                            @config-model="modelManager.showConfig = true"
                            @open-input-preview="handleOpenInputPreview"
                            @open-prompt-preview="handleOpenPromptPreview"
                            :enable-message-optimization="true"
                            :selected-optimize-model="modelManager.selectedOptimizeModel"
                            :selected-template="currentSelectedTemplate"
                            :selected-test-model="modelManager.selectedTestModel"
                            :test-model-provider="selectedTestModelInfo?.provider"
                            :test-model-name="selectedTestModelInfo?.model"
                        >
                            <!-- 优化模型选择插槽 -->
                            <template #optimize-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedOptimizeModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    :disabled="optimizer.isOptimizing"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>

                            <!-- 模板选择插槽 -->
                            <template #template-select>
                                <template
                                    v-if="services && services.templateManager"
                                >
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdForSelect"
                                        :options="templateOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="t('template.select')"
                                        size="medium"
                                        :disabled="optimizer.isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="refreshOptimizeTemplates"
                                        @config="
                                            handleOpenOptimizeTemplateManager
                                        "
                                    />
                                </template>
                                <NText v-else depth="3" class="p-2 text-sm">
                                    {{ t("template.loading") || "加载中..." }}
                                </NText>
                            </template>

                            <!-- 测试模型选择插槽 -->
                            <template #test-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedTestModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>
                        </ContextSystemWorkspace>

                        <!-- 上下文-用户模式 -->
                        <ContextUserWorkspace
                            ref="userWorkspaceRef"
                            v-else-if="contextMode === 'user'"
                            :optimization-mode="selectedOptimizationMode"
                            :selected-optimize-model="modelManager.selectedOptimizeModel"
                            :selected-test-model="modelManager.selectedTestModel"
                            :test-model-provider="selectedTestModelInfo?.provider"
                            :test-model-name="selectedTestModelInfo?.model"
                            :selected-template="currentSelectedTemplate"
                            :selected-iterate-template="
                                optimizer.selectedIterateTemplate
                            "
                            @update:selectedIterateTemplate="
                                optimizer.selectedIterateTemplate = $event
                            "
                            :is-compare-mode="isCompareMode"
                            @update:isCompareMode="isCompareMode = $event"
                            :global-variables="
                                variableManager?.customVariables?.value || {}
                            "
                            :predefined-variables="predefinedVariables"
                            @variable-change="handleTestPanelVariableChange"
                            @save-to-global="handleSaveToGlobal"
                            :control-bar-layout="
                                responsiveLayout.recommendedControlBarLayout
                                    .value
                            "
                            :button-size="
                                responsiveLayout.smartButtonSize.value
                            "
                            :conversation-max-height="
                                responsiveLayout.responsiveHeights.value
                                    .conversationMax
                            "
                            :result-vertical-layout="
                                responsiveLayout.isMobile.value
                            "
                            @compare-toggle="handleTestAreaCompareToggle"
                            @save-favorite="handleSaveFavorite"
                            @open-global-variables="openVariableManager()"
                            @open-variable-manager="handleOpenVariableManager"
                            @openTemplateManager="openTemplateManager"
                            @config-model="modelManager.showConfig = true"
                            @open-input-preview="handleOpenInputPreview"
                            @open-prompt-preview="handleOpenPromptPreview"
                        >
                            <!-- 优化模型选择插槽 -->
                            <template #optimize-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedOptimizeModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    :disabled="optimizer.isOptimizing"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>

                            <!-- 模板选择插槽 -->
                            <template #template-select>
                                <template
                                    v-if="services && services.templateManager"
                                >
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdForSelect"
                                        :options="templateOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="t('template.select')"
                                        size="medium"
                                        :disabled="optimizer.isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="refreshOptimizeTemplates"
                                        @config="
                                            handleOpenOptimizeTemplateManager
                                        "
                                    />
                                </template>
                                <NText v-else depth="3" class="p-2 text-sm">
                                    {{ t("template.loading") || "加载中..." }}
                                </NText>
                            </template>

                            <!-- 测试模型选择插槽 -->
                            <template #test-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedTestModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>
                        </ContextUserWorkspace>
                    </template>

                    <!-- 基础模式：使用 BasicModeWorkspace 组件 -->
                    <template v-else-if="functionMode === 'basic'">
                        <BasicModeWorkspace
                            ref="basicModeWorkspaceRef"
                            :optimization-mode="selectedOptimizationMode"
                            :advanced-mode-enabled="advancedModeEnabled"
                            :prompt="optimizer.prompt"
                            @update:prompt="optimizer.prompt = $event"
                            :optimized-prompt="optimizer.optimizedPrompt"
                            @update:optimized-prompt="optimizer.optimizedPrompt = $event"
                            :optimized-reasoning="optimizer.optimizedReasoning"
                            :is-optimizing="optimizer.isOptimizing"
                            :is-iterating="optimizer.isIterating"
                            :current-versions="optimizer.currentVersions"
                            :current-version-id="optimizer.currentVersionId"
                            :selected-iterate-template="optimizer.selectedIterateTemplate"
                            @update:selectedIterateTemplate="optimizer.selectedIterateTemplate = $event"
                            :test-content="testContent"
                            @update:test-content="testContent = $event"
                            :is-compare-mode="isCompareMode"
                            @update:isCompareMode="isCompareMode = $event"
                            :original-result="testResults.originalResult"
                            :original-reasoning="testResults.originalReasoning"
                            :optimized-result="testResults.optimizedResult"
                            :test-optimized-reasoning="testResults.optimizedReasoning"
                            :is-testing-original="testResults.isTestingOriginal"
                            :is-testing-optimized="testResults.isTestingOptimized"
                            :global-variables="variableManager?.customVariables?.value || {}"
                            :predefined-variables="predefinedVariables"
                            :model-provider="selectedTestModelInfo?.provider"
                            :model-name="selectedTestModelInfo?.model"
                            :has-original-result="!!testResults.originalResult"
                            :has-optimized-result="!!testResults.optimizedResult"
                            :is-evaluating-original="evaluation.isEvaluatingOriginal.value"
                            :is-evaluating-optimized="evaluation.isEvaluatingOptimized.value"
                            :is-evaluating-compare="evaluation.isEvaluatingCompare.value"
                            :original-score="evaluation.originalScore.value"
                            :optimized-score="evaluation.optimizedScore.value"
                            :compare-score="evaluation.compareScore.value"
                            :has-original-evaluation="evaluation.hasOriginalResult.value"
                            :has-optimized-evaluation="evaluation.hasOptimizedResult.value"
                            :has-compare-evaluation="evaluation.hasCompareResult.value"
                            :original-evaluation-result="evaluation.state.original.result"
                            :optimized-evaluation-result="evaluation.state.optimized.result"
                            :compare-evaluation-result="evaluation.state.compare.result"
                            :original-score-level="evaluation.originalLevel.value"
                            :optimized-score-level="evaluation.optimizedLevel.value"
                            :compare-score-level="evaluation.compareLevel.value"
                            :input-mode="responsiveLayout.recommendedInputMode.value"
                            :control-bar-layout="responsiveLayout.recommendedControlBarLayout.value"
                            :button-size="responsiveLayout.smartButtonSize.value"
                            :conversation-max-height="responsiveLayout.responsiveHeights.value.conversationMax"
                            :result-vertical-layout="responsiveLayout.isMobile.value"
                            :analyzing="isBasicAnalyzing"
                            @optimize="handleOptimizePrompt"
                            @iterate="handleIteratePrompt"
                            @switchVersion="handleSwitchVersion"
                            @test="handleTestAreaTest"
                            @compare-toggle="handleTestAreaCompareToggle"
                            @evaluate-original="() => handleEvaluate('original')"
                            @evaluate-optimized="() => handleEvaluate('optimized')"
                            @evaluate-compare="() => handleEvaluate('compare')"
                            @evaluate-prompt-only="handleAnalyzeEvaluate"
                            @show-original-detail="() => evaluation.showDetail('original')"
                            @show-optimized-detail="() => evaluation.showDetail('optimized')"
                            @show-compare-detail="() => evaluation.showDetail('compare')"
                            @apply-improvement="handleApplyImprovement"
                            @apply-patch="handleApplyLocalPatch"
                            @save-local-edit="handleSaveLocalEdit"
                            @save-favorite="handleSaveFavorite"
                            @open-variable-manager="handleOpenVariableManager"
                            @open-input-preview="handleOpenInputPreview"
                            @open-prompt-preview="handleOpenPromptPreview"
                            @config-model="modelManager.showConfig = true"
                            @openTemplateManager="openTemplateManager"
                        >
                            <!-- 优化模型选择插槽 -->
                            <template #optimize-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedOptimizeModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    :disabled="optimizer.isOptimizing"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>

                            <!-- 模板选择插槽 -->
                            <template #template-select>
                                <template v-if="services && services.templateManager">
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdForSelect"
                                        :options="templateOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="OptionAccessors.getSecondary"
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="t('template.select')"
                                        size="medium"
                                        :disabled="optimizer.isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="refreshOptimizeTemplates"
                                        @config="handleOpenOptimizeTemplateManager"
                                    />
                                </template>
                                <NText v-else depth="3" class="p-2 text-sm">
                                    {{ t("template.loading") || "加载中..." }}
                                </NText>
                            </template>

                            <!-- 测试模型选择插槽 -->
                            <template #test-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedTestModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>
                        </BasicModeWorkspace>
                    </template>
                    <!-- 图像模式：渲染新的工作区组件，不破坏现有结构 -->
                    <template v-else>
                        <ImageWorkspace />
                    </template>
                </template>
            </MainLayoutUI>

            <!-- Modals and Drawers that are conditionally rendered -->
            <ModelManagerUI
                v-if="isReady"
                v-model:show="modelManager.showConfig"
                @update:show="
                    (v: boolean) => {
                        if (!v) handleModelManagerClosed();
                    }
                "
            />
            <TemplateManagerUI
                v-if="isReady"
                v-model:show="templateManagerState.showTemplates"
                :templateType="templateManagerState.currentType"
                @close="handleTemplateManagerClosed"
                @languageChanged="handleTemplateLanguageChanged"
            />
            <HistoryDrawerUI
                v-if="isReady"
                v-model:show="historyManager.showHistory"
                :history="promptHistory.history"
                @reuse="handleHistoryReuse"
                @clear="promptHistory.handleClearHistory"
                @deleteChain="promptHistory.handleDeleteChain"
            />
            <DataManagerUI
                v-if="isReady"
                v-model:show="showDataManager"
                @imported="handleDataImported"
            />

            <!-- 收藏管理对话框 -->
            <FavoriteManagerUI
                v-if="isReady"
                :show="showFavoriteManager"
                @update:show="
                    (v: boolean) => {
                        if (!v) showFavoriteManager = false;
                    }
                "
                @optimize-prompt="handleFavoriteOptimizePrompt"
                @use-favorite="handleUseFavorite"
            />

            <!-- 保存收藏对话框 -->
            <SaveFavoriteDialog
                v-if="isReady"
                v-model:show="showSaveFavoriteDialog"
                :content="saveFavoriteData?.content || ''"
                :original-content="saveFavoriteData?.originalContent || ''"
                :current-function-mode="functionMode"
                :current-optimization-mode="selectedOptimizationMode"
                @saved="handleSaveFavoriteComplete"
            />

            <!-- 变量管理弹窗 -->
            <VariableManagerModal
                v-if="isReady"
                v-model:visible="showVariableManager"
                :variable-manager="variableManager"
                :focus-variable="focusVariableName"
            />

            <!-- 工具管理弹窗 -->
            <ToolManagerModal
                v-if="isReady"
                v-model:visible="showToolManager"
                :tools="optimizationContextTools"
                @confirm="handleToolManagerConfirm"
                @cancel="showToolManager = false"
            />

            <!-- 上下文编辑器弹窗 -->
            <ContextEditor
                v-if="isReady"
                v-model:visible="showContextEditor"
                :state="contextEditorState"
                :services="servicesForContextEditor"
                :variable-manager="variableManager"
                :optimization-mode="selectedOptimizationMode"
                :scan-variables="
                    (content) =>
                        variableManager?.variableManager.value?.scanVariablesInContent(
                            content,
                        ) || []
                "
                :replace-variables="
                    (content, vars) =>
                        variableManager?.variableManager.value?.replaceVariables(
                            content,
                            vars,
                        ) || content
                "
                :defaultTab="contextEditorDefaultTab"
                :only-show-tab="contextEditorOnlyShowTab"
                :title="contextEditorTitle"
                @update:state="handleContextEditorStateUpdate"
                @save="handleContextEditorSave"
                @cancel="handleContextEditorCancel"
                @open-variable-manager="handleOpenVariableManager"
            />

            <!-- 提示词预览面板 -->
            <PromptPreviewPanel
                v-if="isReady"
                :show="showPreviewPanel"
                @update:show="showPreviewPanel = $event"
                :previewContent="promptPreview.previewContent.value"
                :missingVariables="promptPreview.missingVariables.value"
                :hasMissingVariables="promptPreview.hasMissingVariables.value"
                :variableStats="promptPreview.variableStats.value"
                :contextMode="contextMode"
                :renderPhase="renderPhase"
            />

            <!-- 评估结果面板 -->
            <EvaluationPanel
                v-if="isReady"
                v-model:show="evaluation.isPanelVisible.value"
                :is-evaluating="evaluation.state.activeDetailType ? evaluation.state[evaluation.state.activeDetailType].isEvaluating : false"
                :result="evaluation.activeResult.value"
                :stream-content="evaluation.activeStreamContent.value"
                :error="evaluation.activeError.value"
                :current-type="evaluation.state.activeDetailType"
                :score-level="evaluation.activeScoreLevel.value"
                @re-evaluate="handleReEvaluate"
                @apply-local-patch="handleApplyLocalPatch"
                @apply-improvement="handleApplyImprovement"
            />

            <!-- 关键:使用NGlobalStyle同步全局样式到body,消除CSS依赖 -->
            <NGlobalStyle />
        </template>
    </NConfigProvider>
</template>

<script setup lang="ts">
/**
 * PromptOptimizerApp - 主应用组件
 *
 * @description
 * 从 App.vue 提取的核心应用逻辑，统一 web 和 extension 应用。
 * 包含所有状态管理、composables 和事件处理。
 */
import {
    ref,
    watch,
    provide,
    computed,
    shallowRef,
    toRef,
    reactive,
    onMounted,
    type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import {
    NConfigProvider,
    NGlobalStyle,
    NText,
    NForm,
    NFormItem,
    NInput,
    NButton,
    NTabs,
    NTabPane,
    NIcon,
} from "naive-ui";
import { PersonOutline, LockClosedOutline, RefreshOutline, CheckmarkCircleOutline } from '@vicons/ionicons5';
import hljs from "highlight.js/lib/core";
import jsonLang from "highlight.js/lib/languages/json";
hljs.registerLanguage("json", jsonLang);

// 内部组件导入
import MainLayoutUI from '../MainLayout.vue'
import ModelManagerUI from '../ModelManager.vue'
import TemplateManagerUI from '../TemplateManager.vue'
import HistoryDrawerUI from '../HistoryDrawer.vue'
import DataManagerUI from '../DataManager.vue'
import FavoriteManagerUI from '../FavoriteManager.vue'
import SaveFavoriteDialog from '../SaveFavoriteDialog.vue'
import VariableManagerModal from '../variable/VariableManagerModal.vue'
import ToolManagerModal from '../tool/ToolManagerModal.vue'
import ImageWorkspace from '../image-mode/ImageWorkspace.vue'
import ContextEditor from '../context-mode/ContextEditor.vue'
import PromptPreviewPanel from '../PromptPreviewPanel.vue'
import ContextSystemWorkspace from '../context-mode/ContextSystemWorkspace.vue'
import ContextUserWorkspace from '../context-mode/ContextUserWorkspace.vue'
import BasicModeWorkspace from '../basic-mode/BasicModeWorkspace.vue'
import SelectWithConfig from '../SelectWithConfig.vue'
import AppHeaderActions from './AppHeaderActions.vue'
import AppCoreNav from './AppCoreNav.vue'
import EvaluationPanel from '../evaluation/EvaluationPanel.vue'

// Composables - 使用 barrel exports
import {
    // 提示词相关
    usePromptOptimizer,
    usePromptHistory,
    usePromptPreview,
    usePromptTester,
    // 模型相关
    useModelManager,
    useModelSelectRefs,
    useFunctionModelManager,
    // 模式相关
    useFunctionMode,
    useBasicSubMode,
    useProSubMode,
    useImageSubMode,
    // 上下文相关
    useContextManagement,
    useContextEditorUIState,
    // 变量相关
    useVariableManager,
    useAggregatedVariables,
    // UI 相关
    useToast,
    useNaiveTheme,
    useResponsiveTestLayout,
    // 系统相关
    useAppInitializer,
    useHistoryManager,
    useTemplateManager,
    useEvaluationHandler,
    provideEvaluation,
    // App 级别
    useAppHistoryRestore,
    useAppFavorite,
} from '../../composables'

// i18n functions
import { initializeI18nWithStorage, setI18nServices } from '../../plugins/i18n'

// Data Transformation
import { DataTransformer, OptionAccessors } from '../../utils/data-transformer'

// Types
import type { OptimizationMode, ConversationMessage, ModelSelectOption, TemplateSelectOption, TestAreaPanelInstance } from '../../types'
import { applyPatchOperationsToText, type IPromptService, type PromptRecordChain, type PromptRecord, type PatchOperation } from "@prompt-optimizer/core";

// 1. 基础 composables
const hljsInstance = hljs;
const { t } = useI18n();
const toast = useToast();

// 2. 初始化应用服务
const { services, isInitializing } = useAppInitializer();

// 3. Initialize i18n with storage when services are ready
watch(
    services,
    async (newServices) => {
        if (newServices) {
            setI18nServices(newServices);
            await initializeI18nWithStorage();
            console.log("[PromptOptimizerApp] i18n initialized");
        }
    },
    { immediate: true },
);

// 4. 向子组件提供服务
provide("services", services);

// 5. 控制主UI渲染的标志
const isReady = computed(() => !!services.value && !isInitializing.value);

// 创建 ContextEditor 使用的 services 引用
const servicesForContextEditor = computed(() => services?.value || null);

// 认证状态管理
type AuthMode = "login" | "register";
type AuthUser = { id: number; username: string; is_admin: number; last_login_at?: string | null };
const AUTH_TOKEN_KEY = "prompt_optimizer_auth_token";

const authState = reactive({
    enabled: false,
    allowRegistration: true,
    loading: true,
    processing: false,
    isAuthenticated: false,
    mode: "login" as AuthMode,
    token:
        (typeof localStorage !== "undefined" && localStorage.getItem(AUTH_TOKEN_KEY)) ||
        "",
    user: null as AuthUser | null,
    error: "",
    captcha: {
        id: null as number | null,
        image: "",
        expiresIn: 0,
        loading: false,
    },
});

const authForm = reactive({
    username: "",
    password: "",
    captcha: "",
});

const formRef = ref<any>(null);

const formRules = computed(() => ({
    username: [
        {
            required: true,
            message: "请输入用户名",
            trigger: ["blur", "input"],
        },
        {
            min: 3,
            max: 20,
            message: "用户名长度应为3-20个字符",
            trigger: ["blur", "input"],
        },
    ],
    password: [
        {
            required: true,
            message: "请输入密码",
            trigger: ["blur", "input"],
        },
        ...(authState.mode === "register"
            ? [
                  {
                      min: 8,
                      message: "密码至少需要8个字符",
                      trigger: ["blur", "input"],
                  },
                  {
                      validator: (_rule: any, value: string) => {
                          if (!value) return true;
                          const hasLetter = /[a-zA-Z]/.test(value);
                          const hasNumber = /[0-9]/.test(value);
                          return hasLetter && hasNumber;
                      },
                      message: "密码必须包含字母和数字",
                      trigger: ["blur", "input"],
                  },
              ]
            : []),
    ],
    captcha: [
        {
            required: true,
            message: "请输入验证码",
            trigger: ["blur", "input"],
        },
    ],
}));

const authBlocking = computed(() => authState.enabled && !authState.isAuthenticated);

function persistToken(token: string) {
    authState.token = token;
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
}

function clearToken() {
    authState.token = "";
    authState.user = null;
    authState.isAuthenticated = false;
    if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }
}

async function refreshCaptcha() {
    if (!authState.enabled) return;
    authState.captcha.loading = true;
    authState.error = "";
    try {
        const res = await fetch("/api/captcha/image");
        const data = await res.json();
        if (res.ok && data?.data?.captcha_id) {
            authState.captcha.id = data.data.captcha_id;
            authState.captcha.image = data.data.image;
            authState.captcha.expiresIn = data.data.expires_in || 0;
        } else {
            authState.error = data?.message || "验证码获取失败，请稍后再试";
        }
    } catch (error) {
        console.warn("[Auth] Failed to fetch captcha", error);
        authState.error = "验证码获取失败，请检查网络";
    } finally {
        authState.captcha.loading = false;
    }
}

async function validateToken(token: string) {
    if (!token) return false;
    try {
        const res = await fetch("/api/auth/me", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await res.json();
        if (res.ok && data?.code === 200) {
            authState.isAuthenticated = true;
            authState.user = data.data;
            authState.error = "";
            return true;
        }
    } catch (error) {
        console.warn("[Auth] Token validation failed", error);
    }
    clearToken();
    await refreshCaptcha();
    return false;
}

function switchAuthMode(mode: AuthMode) {
    if (authState.mode === mode) return;
    authState.mode = mode;
    authState.error = "";
    authForm.captcha = "";
    refreshCaptcha();
}

async function handleSubmitAuth() {
    // 使用 Naive UI 表单验证
    try {
        await formRef.value?.validate();
    } catch (errors: any) {
        console.log("[Auth] Form validation failed:", errors);
        // 从验证错误中提取第一个错误消息
        if (errors && Array.isArray(errors)) {
            const firstError = errors[0];
            if (firstError && Array.isArray(firstError) && firstError[0]?.message) {
                authState.error = firstError[0].message;
            } else {
                authState.error = "请检查输入信息";
            }
        } else {
            authState.error = "请检查输入信息";
        }
        return;
    }

    if (!authState.captcha.id) {
        await refreshCaptcha();
        if (!authState.captcha.id) {
            authState.error = "验证码加载失败，请刷新页面重试";
            return;
        }
    }

    authState.processing = true;
    authState.error = "";

    try {
        const endpoint = authState.mode === "login" ? "/api/auth/login" : "/api/auth/register";
        const payload = {
            username: authForm.username.trim(),
            password: authForm.password,
            captcha_id: authState.captcha.id,
            captcha_code: authForm.captcha,
        };

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data?.code === 200 && data?.data?.token) {
            persistToken(data.data.token);
            authState.user = data.data.user;
            authState.isAuthenticated = true;
            authState.error = "";
            return;
        }

        authState.error = data?.message || "请求失败，请重试";
        await refreshCaptcha();
        // 重新设置错误信息，因为 refreshCaptcha 会清空它
        authState.error = data?.message || "请求失败，请重试";
    } catch (error) {
        console.error("[Auth] request failed", error);
        authState.error = "网络错误，请稍后再试";
        await refreshCaptcha();
        // 重新设置错误信息，因为 refreshCaptcha 会清空它
        authState.error = "网络错误，请稍后再试";
    } finally {
        authState.processing = false;
    }
}

async function initAuth() {
    authState.loading = true;
    authState.error = "";
    try {
        const res = await fetch("/api/auth/config");
        const data = await res.json();
        const enabled = !!data?.data?.enabled;
        authState.enabled = enabled;
        authState.allowRegistration = data?.data?.allowRegistration !== false;

        if (!enabled) {
            authState.isAuthenticated = true;
            return;
        }

        await refreshCaptcha();
        if (authState.token) {
            await validateToken(authState.token);
        }
    } catch (error) {
        console.warn("[Auth] Failed to load config", error);
        // 无法获取配置时，保持需要登录的默认态，避免绕过鉴权
        authState.enabled = true;
        authState.isAuthenticated = false;
        await refreshCaptcha();
    } finally {
        authState.loading = false;
    }
}

onMounted(() => {
    initAuth();
});


// 6. 创建所有必要的引用
const promptService = shallowRef<IPromptService | null>(null);
const showDataManager = ref(false);

type ContextUserHistoryPayload = {
    record: PromptRecord;
    chain: PromptRecordChain;
    rootPrompt: string;
};

type ContextWorkspaceExpose = {
    testAreaPanelRef?: Ref<TestAreaPanelInstance | null>;
    restoreFromHistory?: (payload: ContextUserHistoryPayload) => void;
    openIterateDialog?: (input?: string) => void;
    applyLocalPatch?: (operation: PatchOperation) => void;
    reEvaluateActive?: () => Promise<void>;
};

const systemWorkspaceRef = ref<ContextWorkspaceExpose | null>(null);
const userWorkspaceRef = ref<ContextWorkspaceExpose | null>(null);
const basicModeWorkspaceRef = ref<{
    promptPanelRef?: {
        openIterateDialog?: (input?: string) => void;
        refreshIterateTemplateSelect?: () => void;
    } | null;
    openIterateDialog?: (input?: string) => void;
} | null>(null);

// 高级模式状态
const { functionMode, setFunctionMode } = useFunctionMode(services as any);

// 三种功能模式的子模式持久化（独立存储）
const { basicSubMode, setBasicSubMode } = useBasicSubMode(services as any);
const { proSubMode, setProSubMode } = useProSubMode(services as any);
const { imageSubMode, setImageSubMode } = useImageSubMode(services as any);

// selectedOptimizationMode 改为 computed，从对应的 subMode 动态计算
const selectedOptimizationMode = computed<OptimizationMode>(() => {
    if (functionMode.value === 'basic') return basicSubMode.value as OptimizationMode;
    if (functionMode.value === 'pro') return proSubMode.value as OptimizationMode;
    return 'system';
});

const advancedModeEnabled = computed({
    get: () => functionMode.value === "pro",
    set: (val: boolean) => {
        setFunctionMode(val ? "pro" : "basic");
    },
});

// 处理功能模式变化
const handleModeSelect = async (mode: "basic" | "pro" | "image") => {
    // 模式切换时：关闭并清理评估状态，避免跨模式残留
    evaluation.closePanel();
    evaluation.clearAllResults();

    await setFunctionMode(mode);

    if (mode === "basic") {
        const { ensureInitialized } = useBasicSubMode(services as any);
        await ensureInitialized();
    } else if (mode === "pro") {
        const { ensureInitialized } = useProSubMode(services as any);
        await ensureInitialized();
        await handleContextModeChange(
            proSubMode.value as import("@prompt-optimizer/core").ContextMode,
        );
    } else if (mode === "image") {
        const { ensureInitialized } = useImageSubMode(services as any);
        await ensureInitialized();
    }
};

// 测试内容状态
const testContent = ref("");
const isCompareMode = ref(true);

// 响应式布局
const responsiveLayout = useResponsiveTestLayout();

// Naive UI 主题配置
const { naiveTheme, themeOverrides, initTheme } = useNaiveTheme();

// 初始化主题系统
if (typeof window !== "undefined") {
    initTheme();
}

// 变量管理状态
const showVariableManager = ref(false);
const focusVariableName = ref<string | undefined>(undefined);

// 工具管理状态
const showToolManager = ref(false);

// 上下文模式
const contextMode = ref<import("@prompt-optimizer/core").ContextMode>("system");

// 上下文编辑器状态
const showContextEditor = ref(false);
const contextEditorDefaultTab = ref<"messages" | "variables" | "tools">("messages");

// 使用 composable 管理编辑器 UI 状态
const {
    onlyShowTab: contextEditorOnlyShowTab,
    title: contextEditorTitle,
    handleCancel: handleContextEditorCancel,
} = useContextEditorUIState(showContextEditor, t);

const contextEditorState = ref({
    messages: [] as ConversationMessage[],
    tools: [] as any[],
    showVariablePreview: true,
    showToolManager: false,
    mode: "edit" as "edit" | "preview",
});

// 提示词预览面板状态
const showPreviewPanel = ref(false);

// 变量管理器实例
const variableManager = useVariableManager(services as any);

// 使用聚合变量管理器
const aggregatedVariables = useAggregatedVariables(variableManager);
const promptPreviewContent = ref("");
const promptPreviewVariables = computed(() => {
    return aggregatedVariables.allVariables.value;
});

// 渲染阶段（用于预览）
const renderPhase = ref<"optimize" | "test">("optimize");

const promptPreview = usePromptPreview(
    promptPreviewContent,
    promptPreviewVariables,
    contextMode,
    renderPhase,
);

// 预览处理函数
const handleOpenInputPreview = () => {
    promptPreviewContent.value = optimizer.prompt || "";
    renderPhase.value = "test";
    showPreviewPanel.value = true;
};

const handleOpenPromptPreview = () => {
    promptPreviewContent.value = optimizer.optimizedPrompt || "";
    renderPhase.value = "test";
    showPreviewPanel.value = true;
};

const templateSelectType = computed<
    | "optimize"
    | "userOptimize"
    | "iterate"
    | "conversationMessageOptimize"
    | "contextUserOptimize"
>(() => {
    const isPro = advancedModeEnabled.value;
    if (selectedOptimizationMode.value === "system") {
        return isPro ? "conversationMessageOptimize" : "optimize";
    }
    return isPro ? "contextUserOptimize" : "userOptimize";
});

// 变量管理处理函数
const handleOpenVariableManager = (variableName?: string) => {
    if (variableName) {
        focusVariableName.value = variableName;
    }
    showVariableManager.value = true;
};

// 工具管理器处理函数
const handleOpenToolManager = () => {
    showToolManager.value = true;
};

const handleToolManagerConfirm = (tools: any[]) => {
    optimizationContextTools.value = tools;
    showToolManager.value = false;
};

// 6. 在顶层调用所有 Composables
const modelSelectRefs = useModelSelectRefs();
const modelManager = useModelManager(services as any, modelSelectRefs);
const functionModelManager = useFunctionModelManager(
    services as any,
    computed(() => modelManager.selectedOptimizeModel),
);

// 提示词优化器
const optimizer = usePromptOptimizer(
    services as any,
    selectedOptimizationMode,
    toRef(modelManager, "selectedOptimizeModel"),
    toRef(modelManager, "selectedTestModel"),
    contextMode,
);

// 上下文管理
const contextManagement = useContextManagement({
    services,
    selectedOptimizationMode,
    advancedModeEnabled,
    showContextEditor,
    contextEditorDefaultTab,
    contextEditorState,
    variableManager,
    optimizer,
});

// 从 contextManagement 提取其他状态和方法
const optimizationContext = contextManagement.optimizationContext;
const optimizationContextTools = contextManagement.optimizationContextTools;
const predefinedVariables = contextManagement.predefinedVariables;
const initializeContextPersistence = contextManagement.initializeContextPersistence;
const handleOpenContextEditor = contextManagement.handleOpenContextEditor;
const handleContextEditorSave = contextManagement.handleContextEditorSave;
const handleContextEditorStateUpdate = contextManagement.handleContextEditorStateUpdate;
const handleContextModeChange = contextManagement.handleContextModeChange;

// 提供依赖给子组件
provide("variableManager", variableManager);
provide("optimizationContextTools", optimizationContextTools);

// 基础模式提示词测试
const promptTester = usePromptTester(
    services as any,
    toRef(modelManager, 'selectedTestModel'),
    selectedOptimizationMode,
    variableManager
);

// 测试结果引用
const testResults = computed(() => promptTester.testResults);

// 处理测试面板的变量变化
const handleTestPanelVariableChange = async (_name: string, _value: string) => {
    // 测试变量现在只在TestAreaPanel内部管理
};

// 处理保存测试变量到全局
const handleSaveToGlobal = async (name: string, value: string) => {
    if (!variableManager) {
        console.warn("[PromptOptimizerApp] variableManager not ready");
        return;
    }

    try {
        variableManager.updateVariable(name, value);
        toast.success(t('test.variables.savedToGlobal', { name }));
    } catch (error) {
        console.error("[PromptOptimizerApp] Failed to save variable to global:", error);
        toast.error(t('test.error.saveToGlobalFailed', { name }));
    }
};

// 评估功能
const currentSubMode = computed(() => {
    if (functionMode.value === 'basic') return basicSubMode.value;
    if (functionMode.value === 'pro') return proSubMode.value;
    if (functionMode.value === 'image') return imageSubMode.value;
    return 'system';
});

// 计算当前版本的迭代需求（用于 prompt-iterate 类型的重新评估）
const currentIterateRequirement = computed(() => {
    const versions = optimizer.currentVersions;
    const versionId = optimizer.currentVersionId;
    if (!versions || versions.length === 0 || !versionId) return '';
    const currentVersion = versions.find((v) => v.id === versionId);
    return currentVersion?.iterationNote || '';
});

const evaluationHandler = useEvaluationHandler({
    services: services as any,
    originalPrompt: toRef(optimizer, "prompt") as any,
    optimizedPrompt: toRef(optimizer, "optimizedPrompt") as any,
    testContent,
    testResults: testResults as any,
    evaluationModelKey: computed(() => functionModelManager.effectiveEvaluationModel.value),
    functionMode: functionMode as any,
    subMode: currentSubMode as any,
    currentIterateRequirement,
});

const { evaluation, handleEvaluate, handleReEvaluate: handleReEvaluateBasic } = evaluationHandler;

// 提供评估上下文给子组件
provideEvaluation(evaluation);

// 基础模式“分析”专用 loading（避免与普通 prompt-only 评估混用）
const isBasicAnalyzing = ref(false);

// 同步 contextManagement 中的 contextMode
watch(
    contextManagement.contextMode,
    async (newMode) => {
        // Context 子模式切换时：关闭并清理评估状态，避免残留
        evaluation.closePanel();
        evaluation.clearAllResults();

        contextMode.value = newMode;

        if (functionMode.value === "pro") {
            await setProSubMode(newMode as import("@prompt-optimizer/core").ProSubMode);
        }
    },
    { immediate: true },
);

// 提示词历史
const promptHistory = usePromptHistory(
    services as any,
    toRef(optimizer, "prompt") as any,
    toRef(optimizer, "optimizedPrompt") as any,
    toRef(optimizer, "currentChainId") as any,
    toRef(optimizer, "currentVersions") as any,
    toRef(optimizer, "currentVersionId") as any,
);

provide("promptHistory", promptHistory);

// 历史管理器
const historyManager = useHistoryManager(
    services as any,
    optimizer.prompt as any,
    optimizer.optimizedPrompt as any,
    optimizer.currentChainId as any,
    optimizer.currentVersions as any,
    optimizer.currentVersionId as any,
    promptHistory.handleSelectHistory,
    promptHistory.handleClearHistory,
    promptHistory.handleDeleteChain as any,
);

// App 级别历史记录恢复
const { handleHistoryReuse } = useAppHistoryRestore({
    services: services as any,
    functionMode,
    setFunctionMode,
    basicSubMode,
    setBasicSubMode,
    proSubMode,
    setProSubMode,
    handleContextModeChange,
    handleSelectHistory: promptHistory.handleSelectHistory,
    optimizationContext,
    systemWorkspaceRef,
    userWorkspaceRef,
    t,
});

// App 级别收藏管理
const {
    showFavoriteManager,
    showSaveFavoriteDialog,
    saveFavoriteData,
    handleSaveFavorite,
    handleSaveFavoriteComplete,
    handleFavoriteOptimizePrompt,
    handleUseFavorite,
} = useAppFavorite({
    functionMode,
    setFunctionMode,
    basicSubMode,
    setBasicSubMode,
    proSubMode,
    setProSubMode,
    handleContextModeChange,
    optimizerPrompt: toRef(optimizer, "prompt") as any,
    t,
});

provide("handleSaveFavorite", handleSaveFavorite);

// 模板管理器
const templateManagerState = useTemplateManager(services as any, {
    selectedOptimizeTemplate: toRef(optimizer, "selectedOptimizeTemplate"),
    selectedUserOptimizeTemplate: toRef(optimizer, "selectedUserOptimizeTemplate"),
    selectedIterateTemplate: toRef(optimizer, "selectedIterateTemplate"),
});

const currentSelectedTemplate = computed({
    get() {
        return selectedOptimizationMode.value === "system"
            ? optimizer.selectedOptimizeTemplate
            : optimizer.selectedUserOptimizeTemplate;
    },
    set(newValue) {
        if (!newValue) return;
        if (selectedOptimizationMode.value === "system") {
            optimizer.selectedOptimizeTemplate = newValue;
        } else {
            optimizer.selectedUserOptimizeTemplate = newValue;
        }
    },
});

const templateOptions = ref<TemplateSelectOption[]>([]);
const textModelOptions = ref<ModelSelectOption[]>([]);

const handleOpenOptimizeTemplateManager = () => {
    const type = templateSelectType.value;
    openTemplateManager(type as any);
};

const clearCurrentTemplateSelection = () => {
    if (selectedOptimizationMode.value === "system") {
        optimizer.selectedOptimizeTemplate = null;
    } else {
        optimizer.selectedUserOptimizeTemplate = null;
    }
};

const ensureTemplateSelection = () => {
    const current = currentSelectedTemplate.value;
    const available = templateOptions.value;

    if (current) {
        const matched = available.find((t) => t.raw.id === current.id);
        if (matched) {
            if (matched.raw !== current) {
                currentSelectedTemplate.value = matched.raw;
            }
            return;
        }
    }

    if (available.length > 0) {
        currentSelectedTemplate.value = available[0].raw;
    } else {
        clearCurrentTemplateSelection();
    }
};

const refreshOptimizeTemplates = async () => {
    if (!services.value?.templateManager) {
        templateOptions.value = [];
        clearCurrentTemplateSelection();
        return;
    }

    try {
        const list = await services.value.templateManager.listTemplatesByType(
            templateSelectType.value as any,
        );
        templateOptions.value = DataTransformer.templatesToSelectOptions(list || []);
    } catch (error) {
        console.warn("[PromptOptimizerApp] Failed to refresh optimize templates:", error);
        templateOptions.value = [];
    }

    ensureTemplateSelection();
};

const refreshTextModels = async () => {
    if (!services.value?.modelManager) {
        textModelOptions.value = [];
        return;
    }

    try {
        const manager = services.value.modelManager;
        if (typeof (manager as any).ensureInitialized === "function") {
            await (manager as any).ensureInitialized();
        }
        const enabledModels = await manager.getEnabledModels();
        textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels);

        const availableKeys = new Set(textModelOptions.value.map((opt) => opt.value));
        const fallbackValue = textModelOptions.value[0]?.value || "";
        const selectionReady = modelManager.isModelSelectionReady;

        if (fallbackValue && selectionReady) {
            if (!availableKeys.has(modelManager.selectedOptimizeModel)) {
                modelManager.selectedOptimizeModel = fallbackValue;
            }
            if (!availableKeys.has(modelManager.selectedTestModel)) {
                modelManager.selectedTestModel = fallbackValue;
            }
        }
    } catch (error) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models:", error);
        textModelOptions.value = [];
    }
};

// 获取选中测试模型的详细信息
const selectedTestModelInfo = computed(() => {
    if (!modelManager.selectedTestModel) return null;
    const option = textModelOptions.value.find(
        (o) => o.value === modelManager.selectedTestModel,
    );
    if (!option?.raw) return null;
    return {
        provider: option.raw.providerMeta?.name || option.raw.providerMeta?.id || null,
        model: option.raw.modelMeta?.name || option.raw.modelMeta?.id || null,
    };
});

const selectedTemplateIdForSelect = computed<string>({
    get() {
        const current = currentSelectedTemplate.value;
        if (!current) return "";
        return templateOptions.value.some((t) => t.raw.id === current.id)
            ? current.id
            : "";
    },
    set(id: string) {
        if (!id) {
            clearCurrentTemplateSelection();
            return;
        }
        const tpl = templateOptions.value.find((t) => t.raw.id === id);
        if (tpl) {
            currentSelectedTemplate.value = tpl.raw;
        }
    },
});

watch(
    () => services.value?.templateManager,
    async (manager) => {
        if (manager) {
            await refreshOptimizeTemplates();
        } else {
            templateOptions.value = [];
            clearCurrentTemplateSelection();
        }
    },
    { immediate: true },
);

watch(
    () => services.value?.modelManager,
    async (manager) => {
        if (manager) {
            await refreshTextModels();
        } else {
            textModelOptions.value = [];
        }
    },
    { immediate: true },
);

watch(
    () => templateSelectType.value,
    async () => {
        await refreshOptimizeTemplates();
    },
);

// 7. 监听服务初始化
watch(services, async (newServices) => {
    if (!newServices) return;

    promptService.value = newServices.promptService;
    await initializeContextPersistence();

    if (functionMode.value === "basic") {
        const { ensureInitialized } = useBasicSubMode(services as any);
        await ensureInitialized();
    } else if (functionMode.value === "pro") {
        const { ensureInitialized } = useProSubMode(services as any);
        await ensureInitialized();
        await handleContextModeChange(
            proSubMode.value as import("@prompt-optimizer/core").ContextMode,
        );
    } else if (functionMode.value === "image") {
        const { ensureInitialized } = useImageSubMode(services as any);
        await ensureInitialized();
    }

    const handleGlobalHistoryRefresh = () => {
        promptHistory.initHistory();
    };
    window.addEventListener(
        "prompt-optimizer:history-refresh",
        handleGlobalHistoryRefresh,
    );
});

// 8. 处理数据导入成功后的刷新
const handleDataImported = () => {
    useToast().success(t("dataManager.import.successWithRefresh"));
    setTimeout(() => {
        window.location.reload();
    }, 1500);
};

// 处理优化提示词
const handleOptimizePrompt = () => {
    const shouldClearPromptEvaluation = (() => {
        const hasPrompt = !!optimizer.prompt?.trim();
        const hasMessages = optimizationContext.value.length > 0;
        const hasInput = advancedModeEnabled.value ? (hasPrompt || hasMessages) : hasPrompt;
        const hasTemplate = !!currentSelectedTemplate.value;
        const hasModel = !!modelManager.selectedOptimizeModel;
        return hasInput && hasTemplate && hasModel;
    })();

    // 只有在确定会发起生成时才清除旧的 prompt-only / prompt-iterate 评估结果
    if (shouldClearPromptEvaluation) {
        evaluation.clearResult('prompt-only');
        evaluation.clearResult('prompt-iterate');
    }

    if (advancedModeEnabled.value) {
        const advancedContext = {
            variables:
                variableManager?.variableManager.value?.resolveAllVariables() || {},
            messages:
                optimizationContext.value.length > 0
                    ? optimizationContext.value
                    : undefined,
            tools:
                optimizationContextTools.value.length > 0
                    ? optimizationContextTools.value
                    : undefined,
        };
        optimizer.handleOptimizePromptWithContext(advancedContext);
    } else {
        optimizer.handleOptimizePrompt();
    }
};

// 处理迭代提示词
const handleIteratePrompt = (payload: any) => {
    const shouldClearPromptEvaluation = (() => {
        const hasOriginal = !!payload?.originalPrompt?.trim?.();
        const hasOptimized = !!payload?.optimizedPrompt?.trim?.();
        const hasIterateInput = !!payload?.iterateInput?.trim?.();
        const hasTemplate = !!optimizer.selectedIterateTemplate;
        const hasModel = !!modelManager.selectedOptimizeModel;
        return hasOriginal && hasOptimized && hasIterateInput && hasTemplate && hasModel;
    })();

    // 只有在确定会发起迭代时才清除旧的 prompt-only / prompt-iterate 评估结果
    if (shouldClearPromptEvaluation) {
        evaluation.clearResult('prompt-only');
        evaluation.clearResult('prompt-iterate');
    }

    optimizer.handleIteratePrompt(payload);
};

/**
 * 基础模式"分析"入口：
 * - 清空版本链，创建 V0（与优化同级）
 * - 不写入历史（分析不产生新提示词）
 * - 触发 prompt-only 评估
 */
const handleAnalyzeEvaluate = async () => {
    const prompt = optimizer.prompt || '';
    if (!prompt.trim()) return;

    // 清空版本链，创建虚拟 V0
    optimizer.handleAnalyze();

    // 清理旧的提示词评估结果，避免跨提示词残留
    evaluation.clearResult('prompt-only');
    evaluation.clearResult('prompt-iterate');

    isBasicAnalyzing.value = true;
    try {
        await handleEvaluate('prompt-only');
    } finally {
        isBasicAnalyzing.value = false;
    }
};

const handleSaveLocalEdit = async (payload: { note?: string }) => {
    await optimizer.saveLocalEdit({
        optimizedPrompt: optimizer.optimizedPrompt || '',
        note: payload.note,
        source: 'manual',
    });
    toast.success(t('toast.success.localEditSaved'));
};

// 注：handleEvaluatePromptOnly 已移除，PromptPanel 现在直接通过 inject 的 evaluation context 调用评估方法

// 处理应用评估改进建议
const _basicApplyImprovement = evaluationHandler.createApplyImprovementHandler(basicModeWorkspaceRef);
const getActiveContextWorkspace = (): ContextWorkspaceExpose | null => {
    if (contextMode.value === 'system') return systemWorkspaceRef.value;
    if (contextMode.value === 'user') return userWorkspaceRef.value;
    return null;
};

const handleApplyImprovement = (payload: { improvement: string; type: any }) => {
    // 关闭评估面板
    evaluation.closePanel();

    if (functionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace?.openIterateDialog) {
            // 这里按产品约定属于异常：Context 模式必须可以应用改进建议
            console.error('[PromptOptimizerApp] Context apply-improvement handler missing openIterateDialog');
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        workspace.openIterateDialog(payload.improvement);
        return;
    }

    _basicApplyImprovement(payload);
};

const handleApplyLocalPatch = async (payload: { operation: PatchOperation }) => {
    if (!payload.operation) return;

    if (functionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace || typeof (workspace as any).applyLocalPatch !== 'function') {
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        (workspace as any).applyLocalPatch(payload.operation);
        return;
    }

    // basic 模式：直接覆盖当前 optimizedPrompt（不自动创建新版本）
    // 用户可通过"保存修改"按钮显式保存为新版本
    const current = optimizer.optimizedPrompt || '';
    const result = applyPatchOperationsToText(current, payload.operation);
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'));
        console.warn('[PromptOptimizerApp] Local patch apply failed:', result.report);
        return;
    }
    optimizer.optimizedPrompt = result.text;
    toast.success(t('evaluation.diagnose.applyFix'));
};

// 处理重新评估：始终使用当前模式/工作区的最新状态
const handleReEvaluate = async (): Promise<void> => {
    if (functionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace?.reEvaluateActive) {
            // 这里按产品约定属于异常：Context 模式必须可以重新评估当前内容
            console.error('[PromptOptimizerApp] Context re-evaluate handler missing reEvaluateActive');
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        await workspace.reEvaluateActive();
        return;
    }

    await handleReEvaluateBasic();
};

// 处理切换版本
const handleSwitchVersion = (versionId: any) => {
    // 版本切换时清除 prompt-only / prompt-iterate 评估结果（内容已变更）
    evaluation.clearResult('prompt-only');
    evaluation.clearResult('prompt-iterate');
    optimizer.handleSwitchVersion(versionId);
};

// 打开变量管理器
const openVariableManager = (variableName?: string) => {
    if (variableManager?.refresh) {
        variableManager.refresh();
    }
    focusVariableName.value = variableName;
    showVariableManager.value = true;
};

// 监听变量管理器关闭
watch(showVariableManager, (newValue) => {
    if (!newValue) {
        focusVariableName.value = undefined;
    }
});

// 监听高级模式和优化模式变化
watch(
    [advancedModeEnabled, selectedOptimizationMode],
    ([newAdvancedMode, newOptimizationMode]) => {
        if (newAdvancedMode) {
            if (
                !optimizationContext.value ||
                optimizationContext.value.length === 0
            ) {
                if (newOptimizationMode === "system") {
                    optimizationContext.value = [
                        { role: "system", content: "{{currentPrompt}}" },
                        { role: "user", content: "{{userQuestion}}" },
                    ];
                } else if (newOptimizationMode === "user") {
                    optimizationContext.value = [
                        { role: "user", content: "{{currentPrompt}}" },
                    ];
                }
            }
        }
    },
    { immediate: false },
);

// 打开GitHub仓库
const openGithubRepo = async () => {
    const url = "https://github.com/linshenkx/prompt-optimizer";

    if (typeof window !== "undefined" && (window as any).electronAPI) {
        try {
            await (window as any).electronAPI.shell.openExternal(url);
        } catch (error) {
            console.error("Failed to open external URL in Electron:", error);
            window.open(url, "_blank");
        }
    } else {
        window.open(url, "_blank");
    }
};

// 打开模板管理器
const openTemplateManager = (
    templateType?:
        | "optimize"
        | "userOptimize"
        | "iterate"
        | "text2imageOptimize"
        | "image2imageOptimize"
        | "imageIterate",
) => {
    templateManagerState.currentType =
        (templateType as any) ||
        (selectedOptimizationMode.value === "system"
            ? "optimize"
            : "userOptimize");
    templateManagerState.showTemplates = true;
};

// 基础模式子模式变更处理器
const handleBasicSubModeChange = async (mode: OptimizationMode) => {
    // 子模式切换时：关闭并清理评估状态，避免残留
    evaluation.closePanel();
    evaluation.clearAllResults();
    await setBasicSubMode(mode as import("@prompt-optimizer/core").BasicSubMode);
};

// 上下文模式子模式变更处理器
const handleProSubModeChange = async (mode: OptimizationMode) => {
    // 子模式切换时：关闭并清理评估状态，避免残留
    evaluation.closePanel();
    evaluation.clearAllResults();
    await setProSubMode(mode as import("@prompt-optimizer/core").ProSubMode);

    if (services.value?.contextMode.value !== mode) {
        await handleContextModeChange(
            mode as import("@prompt-optimizer/core").ContextMode,
        );
    }
};

// 图像模式子模式变更处理器
const handleImageSubModeChange = async (
    mode: import("@prompt-optimizer/core").ImageSubMode,
) => {
    // 子模式切换时：关闭并清理评估状态，避免残留
    evaluation.closePanel();
    evaluation.clearAllResults();
    await setImageSubMode(mode);

    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("image-submode-changed", {
                detail: { mode },
            }),
        );
    }
};

// 处理模板语言变化
const handleTemplateLanguageChanged = (_newLanguage: string) => {
    refreshOptimizeTemplates();

    // 通过 BasicModeWorkspace 访问 PromptPanel 的方法
    if (basicModeWorkspaceRef.value?.promptPanelRef?.refreshIterateTemplateSelect) {
        basicModeWorkspaceRef.value.promptPanelRef.refreshIterateTemplateSelect();
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("image-workspace-refresh-iterate-select"));
    }
};

// 向子组件提供统一的 openTemplateManager 接口
provide("openTemplateManager", openTemplateManager);

// 模板管理器关闭回调
const handleTemplateManagerClosed = () => {
    try {
        templateManagerState.handleTemplateManagerClose(() => {
            refreshOptimizeTemplates();
        });
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to run template manager close handler:", e);
    }
    refreshOptimizeTemplates();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("image-workspace-refresh-templates"));
    }
};

// 提供 openModelManager 接口
const openModelManager = (tab: "text" | "image" | "function" = "text") => {
    modelManager.showConfig = true;
    setTimeout(() => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("model-manager:set-tab", { detail: tab }),
            );
        }
    }, 0);
};
provide("openModelManager", openModelManager);

// 模型管理器关闭回调
const handleModelManagerClosed = async () => {
    try {
        modelManager.handleModelManagerClose();
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models after manager close:", e);
    }
    await refreshTextModels();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("image-workspace-refresh-text-models"));
        window.dispatchEvent(new Event("image-workspace-refresh-image-models"));
    }
};

// 基础模式的测试处理函数
const handleTestAreaTest = async (testVariables?: Record<string, string>) => {
    // 只清除测试相关的评估结果，保留左侧提示词评估（prompt-only/prompt-iterate）
    evaluation.clearResult('original');
    evaluation.clearResult('optimized');
    evaluation.clearResult('compare');

    await promptTester.executeTest(
        optimizer.prompt,
        optimizer.optimizedPrompt,
        testContent.value,
        isCompareMode.value,
        testVariables || {}
    );
};

const handleTestAreaCompareToggle = () => {
    // Compare mode toggle handler
};
</script>

<style scoped>
.active-button {
    background-color: var(--primary-color, #3b82f6) !important;
    color: white !important;
    border-color: var(--primary-color, #3b82f6) !important;
}

.active-button:hover {
    background-color: var(--primary-hover-color, #2563eb) !important;
    border-color: var(--primary-hover-color, #2563eb) !important;
}

.loading-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.2rem;
    color: var(--text-color);
    background-color: var(--background-color);
}

.loading-container.error {
    color: #f56c6c;
}

.spinner {
    border: 4px solid rgba(128, 128, 128, 0.2);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-left-color: var(--primary-color);
    animation: spin 1s ease infinite;
    margin-bottom: 20px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.auth-wrapper {
    position: relative;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    overflow: hidden;
}

.auth-wrapper::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 40% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
    pointer-events: none;
    animation: gradientShift 15s ease infinite;
}

@keyframes gradientShift {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
}

.auth-card {
    position: relative;
    z-index: 1;
    width: min(480px, 100%);
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    padding: 48px 40px;
    animation: cardSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes cardSlideIn {
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.auth-header {
    text-align: center;
    margin-bottom: 32px;
}

.auth-logo {
    display: flex;
    justify-content: center;
    margin-bottom: 24px;
}

.logo-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    color: white;
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
    animation: logoFloat 3s ease-in-out infinite;
}

.logo-icon svg {
    width: 36px;
    height: 36px;
}

@keyframes logoFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
}

.auth-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 12px 0;
    color: #1a202c;
    letter-spacing: -0.02em;
}

.auth-subtitle {
    margin: 0;
    color: #718096;
    font-size: 15px;
    line-height: 1.6;
}

.auth-tabs {
    margin-bottom: 32px;
}

.auth-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.auth-form :deep(.n-input .n-input__input) {
    align-items: center;
}

.auth-form :deep(.n-input .n-input__input-el) {
    height: var(--n-height);
    line-height: var(--n-height);
    padding-top: 0;
    padding-bottom: 0;
}

.auth-form :deep(.n-input .n-input__prefix),
.auth-form :deep(.n-input .n-input__suffix),
.auth-form :deep(.n-input .n-input__clear),
.auth-form :deep(.n-input .n-input__eye) {
    display: inline-flex;
    align-items: center;
}

.captcha-container {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
}

.captcha-input {
    flex: 1;
    min-width: 0;
}

.captcha-image {
    width: 120px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    background: #f7fafc;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.captcha-image:hover {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.captcha-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.captcha-placeholder {
    font-size: 12px;
    color: #a0aec0;
}

.captcha-refresh-btn {
    flex-shrink: 0;
}

.auth-error {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
    border: 1px solid #fc8181;
    border-radius: 12px;
    color: #c53030;
    font-size: 14px;
    animation: errorShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes errorShake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.error-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
}

.auth-submit {
    margin-top: 8px;
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(102, 126, 234, 0.4);
}

.auth-submit:active:not(:disabled) {
    transform: translateY(0);
}

@media (max-width: 640px) {
    .auth-wrapper {
        padding: 16px;
    }

    .auth-card {
        padding: 32px 24px;
    }

    .auth-title {
        font-size: 24px;
    }

    .auth-subtitle {
        font-size: 14px;
    }

    .logo-icon {
        width: 56px;
        height: 56px;
    }

    .logo-icon svg {
        width: 32px;
        height: 32px;
    }

    .captcha-image {
        width: 100px;
    }
}
</style>
