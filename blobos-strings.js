
(async () => {
  window.strings = {};

  try {
    const res = await fetch("/strings.json");

    if (!res.ok) {
      console.error("Failed to load strings.json:", res.status);
      return;
    }

    window.strings = await res.json();

    function translateText(root) {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;

      while ((node = walker.nextNode())) {
        node.nodeValue = node.nodeValue.replace(
          /@string\/([a-zA-Z0-9_.-]+)/g,
          (match, key) => {
            return Object.prototype.hasOwnProperty.call(window.strings, key)
              ? window.strings[key]
              : match;
          }
        );
      }
    }

    // Translate existing page content
    translateText(document.body);

    // Watch for dynamically created elements
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        // Translate newly added elements
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.TEXT_NODE) {
            addedNode.nodeValue = addedNode.nodeValue.replace(
              /@string\/([a-zA-Z0-9_.-]+)/g,
              (match, key) => {
                return Object.prototype.hasOwnProperty.call(window.strings, key)
                  ? window.strings[key]
                  : match;
              }
            );
          } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
            translateText(addedNode);
          }
        }

        // Translate modified text nodes
        if (mutation.type === "characterData") {
          const node = mutation.target;

          node.nodeValue = node.nodeValue.replace(
            /@string\/([a-zA-Z0-9_.-]+)/g,
            (match, key) => {
              return Object.prototype.hasOwnProperty.call(window.strings, key)
                ? window.strings[key]
                : match;
            }
          );
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });

    window.stringObserver = observer;

  } catch (error) {
    console.error("String localization error:", error);
  }
})();
