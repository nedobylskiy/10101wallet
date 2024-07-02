import path from 'path';
import {fileURLToPath} from 'url';
import {CleanWebpackPlugin} from "clean-webpack-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    target: 'webworker',
    entry: './service-worker.mjs',
    output: {
        filename: 'service-worker.js',
        path: path.resolve(__dirname, 'dist'),
    },
    devtool: 'source-map',
    mode: 'development',
    resolve: {
        fallback: {
            "http": 'stream-http',
            "https": 'https-browserify',
            "crypto": 'crypto-browserify',
            "stream": 'stream-browserify',
            "assert": 'assert/'
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    plugins: [
        // new CleanWebpackPlugin() // Очистка директории dist перед сборкой
    ]
};
