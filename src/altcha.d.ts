import * as React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            // Correct format: DetailedHTMLProps< HTMLAttributes, HTMLElement > & CustomAttributes
            'altcha-widget': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            > & {
                challengeurl?: string;
                name?: string;
                strings?: string;
                hidefooter?: string;
                hidelogo?: string;
                theme?: string;
            };
        }
    }
}
