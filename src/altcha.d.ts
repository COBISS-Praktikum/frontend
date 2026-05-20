import * as React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'altcha-widget': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                challengeurl?: string;
                name?: string;
                strings?: string;
                hidefooter?: string;
                hidelogo?: string;
            },
                HTMLElement
            >;
        }
    }
}