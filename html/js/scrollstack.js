// ScrollStack Vanilla JavaScript Implementation
class ScrollStack {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemDistance: options.itemDistance || 100,
            itemScale: options.itemScale || 0.03,
            itemStackDistance: options.itemStackDistance || 30,
            stackPosition: options.stackPosition || '20%',
            scaleEndPosition: options.scaleEndPosition || '10%',
            baseScale: options.baseScale || 0.85,
            rotationAmount: options.rotationAmount || 0,
            blurAmount: options.blurAmount || 0,
            useWindowScroll: options.useWindowScroll || false,
            className: options.className || '',
            ...options
        };

        this.scroller = null;
        this.cards = [];
        this.lastTransforms = new Map();
        this.isUpdating = false;
        this.stackCompleted = false;
        this.animationFrame = null;

        this.init();
    }

    init() {
        this.scroller = this.container.querySelector('.scroll-stack-scroller') || this.container;
        this.cards = Array.from(this.scroller.querySelectorAll('.scroll-stack-card'));
        
        // Add wrapper class
        if (this.options.className) {
            this.scroller.classList.add(this.options.className);
        }

        // Setup cards
        this.cards.forEach((card, i) => {
            if (i < this.cards.length - 1) {
                card.style.marginBottom = `${this.options.itemDistance}px`;
            }
            card.style.willChange = 'transform, filter';
            card.style.transformOrigin = 'top center';
            card.style.backfaceVisibility = 'hidden';
            card.style.transform = 'translateZ(0)';
            card.style.webkitTransform = 'translateZ(0)';
            card.style.perspective = '1000px';
            card.style.webkitPerspective = '1000px';
        });

        // Start scroll listener
        this.setupScroll();
        this.updateCardTransforms();

        // Start animation loop
        this.startAnimation();
    }

    calculateProgress(scrollTop, start, end) {
        if (scrollTop < start) return 0;
        if (scrollTop > end) return 1;
        return (scrollTop - start) / (end - start);
    }

    parsePercentage(value, containerHeight) {
        if (typeof value === 'string' && value.includes('%')) {
            return (parseFloat(value) / 100) * containerHeight;
        }
        return parseFloat(value);
    }

    getScrollData() {
        if (this.options.useWindowScroll) {
            return {
                scrollTop: window.scrollY,
                containerHeight: window.innerHeight,
                scrollContainer: document.documentElement
            };
        } else {
            return {
                scrollTop: this.scroller.scrollTop,
                containerHeight: this.scroller.clientHeight,
                scrollContainer: this.scroller
            };
        }
    }

    getElementOffset(element) {
        if (this.options.useWindowScroll) {
            const rect = element.getBoundingClientRect();
            return rect.top + window.scrollY;
        } else {
            return element.offsetTop;
        }
    }

    updateCardTransforms = () => {
        if (!this.cards.length || this.isUpdating) return;

        this.isUpdating = true;

        const { scrollTop, containerHeight } = this.getScrollData();
        const stackPositionPx = this.parsePercentage(this.options.stackPosition, containerHeight);
        const scaleEndPositionPx = this.parsePercentage(this.options.scaleEndPosition, containerHeight);

        const endElement = this.options.useWindowScroll 
            ? document.querySelector('.scroll-stack-end')
            : this.scroller.querySelector('.scroll-stack-end');

        const endElementTop = endElement ? this.getElementOffset(endElement) : 0;

        this.cards.forEach((card, i) => {
            if (!card) return;

            const cardTop = this.getElementOffset(card);
            const triggerStart = cardTop - stackPositionPx - (this.options.itemStackDistance * i);
            const triggerEnd = cardTop - scaleEndPositionPx;
            const pinStart = cardTop - stackPositionPx - (this.options.itemStackDistance * i);
            const pinEnd = endElementTop - (containerHeight / 2);

            const scaleProgress = this.calculateProgress(scrollTop, triggerStart, triggerEnd);
            const targetScale = this.options.baseScale + (i * this.options.itemScale);
            const scale = 1 - (scaleProgress * (1 - targetScale));
            const rotation = this.options.rotationAmount ? i * this.options.rotationAmount * scaleProgress : 0;

            let blur = 0;
            if (this.options.blurAmount) {
                let topCardIndex = 0;
                for (let j = 0; j < this.cards.length; j++) {
                    const jCardTop = this.getElementOffset(this.cards[j]);
                    const jTriggerStart = jCardTop - stackPositionPx - (this.options.itemStackDistance * j);
                    if (scrollTop >= jTriggerStart) {
                        topCardIndex = j;
                    }
                }

                if (i < topCardIndex) {
                    const depthInStack = topCardIndex - i;
                    blur = Math.max(0, depthInStack * this.options.blurAmount);
                }
            }

            let translateY = 0;
            const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd;

            if (isPinned) {
                translateY = scrollTop - cardTop + stackPositionPx + (this.options.itemStackDistance * i);
            } else if (scrollTop > pinEnd) {
                translateY = pinEnd - cardTop + stackPositionPx + (this.options.itemStackDistance * i);
            }

            const newTransform = {
                translateY: Math.round(translateY * 100) / 100,
                scale: Math.round(scale * 1000) / 1000,
                rotation: Math.round(rotation * 100) / 100,
                blur: Math.round(blur * 100) / 100
            };

            const lastTransform = this.lastTransforms.get(i);
            const hasChanged =
                !lastTransform ||
                Math.abs(lastTransform.translateY - newTransform.translateY) > 0.1 ||
                Math.abs(lastTransform.scale - newTransform.scale) > 0.001 ||
                Math.abs(lastTransform.rotation - newTransform.rotation) > 0.1 ||
                Math.abs(lastTransform.blur - newTransform.blur) > 0.1;

            if (hasChanged) {
                const transform = `translate3d(0, ${newTransform.translateY}px, 0) scale(${newTransform.scale}) rotate(${newTransform.rotation}deg)`;
                const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : '';

                card.style.transform = transform;
                card.style.filter = filter;

                this.lastTransforms.set(i, newTransform);
            }

            // Stack complete callback
            if (i === this.cards.length - 1) {
                const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
                if (isInView && !this.stackCompleted) {
                    this.stackCompleted = true;
                    if (typeof this.options.onStackComplete === 'function') {
                        this.options.onStackComplete();
                    }
                } else if (!isInView && this.stackCompleted) {
                    this.stackCompleted = false;
                }
            }
        });

        this.isUpdating = false;
    };

    setupScroll() {
        if (this.options.useWindowScroll) {
            window.addEventListener('scroll', this.handleScroll, { passive: true });
        } else {
            this.scroller.addEventListener('scroll', this.handleScroll, { passive: true });
        }
    }

    handleScroll = () => {
        this.updateCardTransforms();
    };

    startAnimation() {
        const animate = (time) => {
            this.animationFrame = requestAnimationFrame(animate);
            // Smooth updates
            if (!this.isUpdating) {
                this.updateCardTransforms();
            }
        };
        this.animationFrame = requestAnimationFrame(animate);
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        if (this.options.useWindowScroll) {
            window.removeEventListener('scroll', this.handleScroll);
        } else {
            this.scroller.removeEventListener('scroll', this.handleScroll);
        }

        this.cards.forEach(card => {
            card.style.transform = '';
            card.style.filter = '';
            card.style.marginBottom = '';
        });

        this.cards = [];
        this.lastTransforms.clear();
        this.stackCompleted = false;
    }
}

// ScrollStackItem function (equivalent to React component)
function createScrollStackItem(content, className = '') {
    const wrapper = document.createElement('div');
    wrapper.className = 'scroll-stack-card-wrapper';
    
    const card = document.createElement('div');
    card.className = `scroll-stack-card ${className}`.trim();
    card.innerHTML = content;
    
    wrapper.appendChild(card);
    return wrapper;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const testimonialsSection = document.getElementById('testimonials');
    if (testimonialsSection) {
        const scrollStack = new ScrollStack(testimonialsSection, {
            itemDistance: 100,
            itemScale: 0.03,
            itemStackDistance: 30,
            stackPosition: '20%',
            scaleEndPosition: '10%',
            baseScale: 0.85,
            rotationAmount: 2,
            blurAmount: 0.5,
            useWindowScroll: false
        });

        // Store reference for cleanup if needed
        window.scrollStackInstance = scrollStack;
    }
});