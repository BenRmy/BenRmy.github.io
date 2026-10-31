# 更新指南

该项目目前仍处于维护中，如果需要更新，请按照以下步骤进行：

首先在 `package.json` 中确认版本号，或者在这里或 [Release](https://github.com/Motues/Momo/releases) 中查看改动记录。

当只有项目的配置文件的结构修改后，才会对项目的版本号进行修改。项目配置文件即和网站布局内容相关的文件，包括`astro.config.mjs`、`src/config.ts`、`src/content.config.ts`、`src/i18n/`文件夹下的文件。

`src/content/`、`src/assets` 、`public` 文件夹下存放博客文字、图片等内容。

## 版本号未变

可以直接克隆本项目，然后将自己原本的配置文件覆盖到新项目，然后运行 `pnpm install` 安装依赖，然后运行 `pnpm build` 本地编译，然后运行 `pnpm preview` 预览编译后的项目。

在本仓库内更新时，可以直接执行 `pnpm momo update`：它会读取 [Release](https://github.com/Motues/Momo/releases) 里的最新版本，与 `package.json` 的版本号对比后下载该版本源码，**保留你自己的文章与图片**（`src/content`、`src/assets`、`public`）和 `src/config.ts`，覆盖其余代码，**删除新版本已经移除的旧文件**并安装依赖，最后列出本次更新中**需要手工合并的配置文件**。默认对比的就是**最新 Release**；想第一时间用上尚未发版的新代码时，加 `--commit <分支/标签/SHA>`（例如 `pnpm momo update --commit main`）即可改为同步某个提交：它会先读远端文件树与本地文件逐个比对，`--check` / `--dry-run` 不用下载源码包就能列出差异，真正下载时按解析出来的不可变 SHA 取包、并用这份哈希清单校验解压结果。删除只针对「上一版模板里有、新版本已移除」的文件（依据更新时写下的 `.momo/manifest.json`，首次更新时读取当前版本 tag 的文件列表），你自己新增的文件不受影响；被删除的文件会和被覆盖的文件一起备份在 `.backup/update-<时间戳>/overwritten/` 里。更新前可以先用 `pnpm momo update --dry-run` 预览将要变更的文件，加 `--no-delete` 则只覆盖不删除；配置出问题可以用 `pnpm momo restore <备份名>` 回滚。国内直连 GitHub 常常超时，`momo update` 会**自动挑选最快的下载源**：并行探测 GitHub 直连与一批公共镜像（gh-proxy 等），按实测速度选最快的下载、失败就换下一个，上次成功的源记在 `.momo/mirror.json` 里一小时内复用；也可以用 `--mirror <镜像前缀>` 或环境变量 `MOMO_MIRROR` 指定镜像，`--mirror direct` 强制只用直连。

## 版本号改变

每次版本号改变时，都会在这里更新的改动记录。更新需要参考具体的记录修改对应的配置文件。

下面是一般修改建议。

* **`astro.config.mjs` 修改**：一般直接覆盖即可，其中的 `site` 与 `i18n` 会自动读取 `src/config.ts` 的 `siteConfig.rootSiteUrl`、`i18nConfig.defaultLanguage`、`i18nConfig.supportedLanguages`
* **`config.ts` 修改**：需要按照要求更新填写 `config.ts` 中新添加或修改的配置信息
* **`content.config.ts` 修改**：一般为文章添加了新的 frontmatter 配置，需要按照要求对文章添加新的配置项
* **`src/i18n/` 修改**：一般为添加了新的国际化翻译，直接覆盖即可。注意各页面的 Cover 文案（`cover.title` / `cover.subTitle`）已迁移到 `src/config.ts` 的 `i18nConfig.translations` 中，请在那里修改为自己的信息
