FROM mcr.microsoft.com/devcontainers/rust:1-1-bullseye

RUN curl -s https://gist.githubusercontent.com/LukeChannings/09d53f5c364391042186518c8598b85e/raw/ac8cd8c675b985edd4b3e16df63ffef14d1f0e24/deno_install.sh -o /tmp/deno_install.sh

USER vscode

RUN zsh /tmp/deno_install.sh \
    && echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.zshrc